<?php

declare(strict_types=1);

namespace App\Domain\Iam\Actions;

use App\Domain\Admin\Support\NotificationLog;
use App\Domain\Admin\Support\PgArray;
use App\Domain\Iam\Models\User;
use App\Domain\Iam\Support\AccessMap;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class RequestAccess
{
    public function __construct(
        private readonly AccessMap $access,
        private readonly NotificationLog $notifications,
        private readonly AuditLogger $audit,
    ) {}

    public function __invoke(User $user, string $path): array
    {
        $path = '/'.trim(Str::before($path, '?'), '/');

        if ($this->access->allows($user, $path)) {
            throw ApiException::unprocessable('ACCESS_ALREADY_GRANTED', 'Ya tienes acceso a esta pantalla. Vuelve a intentarlo.');
        }

        $required = $this->access->requiredFor($path);

        return DB::transaction(function () use ($user, $path, $required): array {
            $pending = DB::table('iam_access_requests')->where('user_id', $user->getKey())->where('path', $path)->where('status', 'pendiente')->lockForUpdate()->exists();

            if ($pending) {
                throw ApiException::conflict('ACCESS_REQUEST_PENDING', 'Ya enviaste esta solicitud. El administrador la revisará pronto.');
            }

            $id = (string) Str::uuid7();
            DB::table('iam_access_requests')->insert([
                'id' => $id,
                'user_id' => $user->getKey(),
                'path' => mb_substr($path, 0, 250),
                'required_permissions' => PgArray::from($required),
                'status' => 'pendiente',
                'created_by' => $user->getKey(),
            ]);

            $admins = DB::table('iam_users as u')
                ->join('model_has_roles as m', 'm.model_id', '=', 'u.id')
                ->join('roles as r', 'r.id', '=', 'm.role_id')
                ->where('r.name', 'tenant_admin')
                ->where('u.status', 'activo')
                ->whereNull('u.deleted_at')
                ->where('u.id', '<>', $user->getKey())
                ->distinct()
                ->get(['u.id', 'u.email']);

            foreach ($admins as $admin) {
                $this->notifications->record([
                    'event_code' => 'acceso.solicitud',
                    'channel' => 'portal',
                    'recipient_user_id' => $admin->id,
                    'subject' => "{$user->name} pide acceso a {$path}",
                    'body_rendered' => $required === [] ? null : 'Permisos que lo habilitan: '.implode(', ', $required),
                    'source_type' => 'Acceso',
                    'source_id' => $id,
                    'created_by' => $user->getKey(),
                ]);
            }

            $this->audit->log('Acceso', $path, 'solicitar_acceso', null, $required === [] ? null : implode(', ', $required));

            return ['id' => $id, 'path' => $path, 'status' => 'pendiente', 'required_permissions' => $required, 'notified' => $admins->count()];
        });
    }
}
