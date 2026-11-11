<?php

declare(strict_types=1);

namespace App\Domain\Site\Support;

use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Site\Actions\CaptureWebLead;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class WebClients
{
    public const DOC_TYPES = ['DNI' => 'DNI', 'CE' => 'CE', 'Pasaporte' => 'PASAPORTE'];

    public function __construct(
        private readonly TenantContext $context,
        private readonly CodeSequence $codes,
        private readonly AuditLogger $audit,
    ) {}

    public function resolve(array $data, string $owner, bool $marketing): string
    {
        $email = Str::lower(trim((string) $data['email']));
        $existing = DB::table('crm_clients')->whereNull('deleted_at')->where('email_norm', $email)->value('id');

        if ($existing) {
            return (string) $existing;
        }

        $id = (string) Str::uuid7();
        $code = $this->codes->next('crm_clients', 'CLI-');
        $document = Str::upper((string) preg_replace('/\s+/', '', (string) ($data['doc_number'] ?? '')));
        DB::table('crm_clients')->insert([
            'id' => $id,
            'tenant_id' => $this->context->idOrFail(),
            'code' => $code,
            'kind' => 'persona',
            'name' => trim((string) $data['name']),
            'doc_type' => $document === '' ? null : (self::DOC_TYPES[$data['doc_type'] ?? 'DNI'] ?? 'DNI'),
            'doc_number' => $document === '' ? null : $document,
            'email' => $email,
            'phone' => $data['phone'] ?? null,
            'phone_norm' => substr((string) preg_replace('/\D/', '', (string) ($data['phone'] ?? '')), -9) ?: null,
            'country' => $data['country'] ?? 'Perú',
            'segment_code' => 'Retail',
            'owner_id' => $owner,
            'tags' => '{Web}',
            'consents' => json_encode(['privacy' => true, 'marketing' => $marketing, 'policy_version' => CaptureWebLead::POLICY_VERSION], JSON_UNESCAPED_UNICODE),
        ]);
        $this->audit->log('Cliente', $code, 'crear_desde_sitio_web', after: 'Retail · Web');

        return $id;
    }

    public function owner(): string
    {
        foreach (['channels.ecommerce.manage', 'reservations.create'] as $permission) {
            $id = DB::table('iam_users as u')
                ->join('model_has_roles as mr', 'mr.model_id', '=', 'u.id')
                ->join('role_has_permissions as rp', 'rp.role_id', '=', 'mr.role_id')
                ->join('permissions as p', 'p.id', '=', 'rp.permission_id')
                ->whereNull('u.deleted_at')->where('u.status', 'activo')->whereNull('u.client_id')->where('p.name', $permission)
                ->orderBy('u.code')->value('u.id');

            if ($id) {
                return (string) $id;
            }
        }

        throw ApiException::conflict('ECOM_OWNER', 'La agencia aún no tiene un responsable de ventas en línea.');
    }
}
