<?php

declare(strict_types=1);

namespace App\Domain\Iam\Actions;

use App\Domain\Iam\Models\Sede;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class SedeAdmin
{
    private const MANAGER_ROLES = ['tenant_admin', 'manager', 'sales', 'operations', 'finance'];

    public function __construct(private readonly AuditLogger $audit, private readonly TenantContext $context) {}

    public function list(): Collection
    {
        $users = DB::table('iam_users')->whereNull('deleted_at')->where('status', 'activo')->selectRaw('sede_id, count(*) as total')->groupBy('sede_id')->pluck('total', 'sede_id');
        $reservations = DB::table('booking_reservations')->whereNull('deleted_at')->whereNotNull('sede_id')->selectRaw('sede_id, count(*) as total')->groupBy('sede_id')->pluck('total', 'sede_id');

        return DB::table('iam_sedes as s')->leftJoin('iam_users as m', 'm.id', '=', 's.manager_user_id')->whereNull('s.deleted_at')
            ->orderByDesc('s.is_main')->orderBy('s.name')
            ->get(['s.id', 's.code', 's.name', 's.city', 's.address', 's.phone', 's.status', 's.is_main', 's.manager_user_id', 'm.name as manager_name'])
            ->map(fn (object $sede) => [
                'id' => $sede->id,
                'code' => $sede->code,
                'name' => $sede->name,
                'city' => $sede->city,
                'address' => $sede->address,
                'phone' => $sede->phone,
                'status' => $sede->status,
                'is_main' => (bool) $sede->is_main,
                'manager' => $sede->manager_user_id ? ['id' => $sede->manager_user_id, 'name' => $sede->manager_name] : null,
                'users' => (int) ($users[$sede->id] ?? 0),
                'reservations' => (int) ($reservations[$sede->id] ?? 0),
            ]);
    }

    public function managers(): Collection
    {
        return DB::table('iam_users as u')->join('model_has_roles as m', 'm.model_id', '=', 'u.id')->join('roles as r', 'r.id', '=', 'm.role_id')
            ->whereIn('r.name', self::MANAGER_ROLES)->where('u.status', 'activo')->whereNull('u.deleted_at')->orderBy('u.name')->get(['u.id', 'u.name']);
    }

    public function limit(): ?int
    {
        $value = DB::connection('pgsql_platform')->table('plan_limits')->where('plan_id', $this->context->tenant()->plan_id)->where('metric', 'sedes')->value('value');

        return $value === null ? null : (int) $value;
    }

    public function create(array $data, User $actor): string
    {
        $limit = $this->limit();
        $active = DB::table('iam_sedes')->whereNull('deleted_at')->where('status', 'activa')->count();

        if ($limit !== null && $active >= $limit) {
            throw ApiException::conflict('SED-BR-02', "Tu plan permite {$limit} ".($limit === 1 ? 'sede' : 'sedes').'. Mejora el plan para abrir otra.');
        }

        $values = $this->values($data, null);

        return DB::transaction(function () use ($values, $actor): string {
            DB::select('select pg_advisory_xact_lock(hashtext(?))', ["{$this->context->idOrFail()}:iam_sedes"]);
            $numbers = DB::table('iam_sedes')->where('code', 'like', 'SED-%')->pluck('code')->map(fn (string $code) => (int) Str::after($code, 'SED-'));
            $code = 'SED-'.str_pad((string) (($numbers->max() ?? 0) + 1), 2, '0', STR_PAD_LEFT);
            Sede::query()->create([...$values, 'code' => $code, 'status' => 'activa', 'is_main' => false, 'created_by' => $actor->getKey()]);
            $this->audit->log('Sede', $code, 'crear', after: $values['name']);

            return $code;
        });
    }

    public function update(string $code, array $data, User $actor): void
    {
        $sede = $this->sede($code);
        $values = $this->values($data, $sede);
        $labels = ['name' => 'Nombre', 'city' => 'Ciudad', 'address' => 'Dirección', 'phone' => 'Teléfono', 'manager_user_id' => 'Responsable'];
        $changed = array_filter($labels, fn (string $label, string $field) => (string) $values[$field] !== (string) $sede->getAttribute($field), ARRAY_FILTER_USE_BOTH);

        if ($changed === []) {
            return;
        }

        $sede->forceFill([...$values, 'updated_by' => $actor->getKey()])->save();
        $this->audit->log('Sede', $code, 'editar', after: implode(', ', $changed));
    }

    public function setStatus(string $code, bool $active, User $actor): void
    {
        $sede = $this->sede($code);

        if ($active) {
            $limit = $this->limit();
            $count = DB::table('iam_sedes')->whereNull('deleted_at')->where('status', 'activa')->count();
            if ($limit !== null && $count >= $limit) {
                throw ApiException::conflict('SED-BR-02', "Tu plan permite {$limit} ".($limit === 1 ? 'sede activa' : 'sedes activas').'.');
            }
        } else {
            $users = DB::table('iam_users')->where('sede_id', $sede->getKey())->where('status', 'activo')->whereNull('deleted_at')->count();
            if ($users > 0) {
                throw ApiException::conflict('SED-BR-03', "No se puede desactivar {$sede->name}: tiene {$users} ".($users === 1 ? 'usuario activo' : 'usuarios activos').'. Cámbialos de sede primero.');
            }
            if (DB::table('iam_sedes')->whereNull('deleted_at')->where('status', 'activa')->where('id', '<>', $sede->getKey())->doesntExist()) {
                throw ApiException::conflict('SED-BR-03', 'La agencia necesita al menos una sede activa.');
            }
        }

        $sede->forceFill(['status' => $active ? 'activa' : 'inactiva', 'updated_by' => $actor->getKey()])->save();
        $this->audit->log('Sede', $code, $active ? 'activar' : 'desactivar', $active ? 'inactiva' : 'activa', $active ? 'activa' : 'inactiva');
    }

    public function delete(string $code, User $actor): void
    {
        $sede = $this->sede($code);
        $users = DB::table('iam_users')->where('sede_id', $sede->getKey())->count();
        $reservations = DB::table('booking_reservations')->where('sede_id', $sede->getKey())->count();

        if ($users + $reservations > 0 || $sede->is_main) {
            throw ApiException::conflict('SED-BR-04', $sede->is_main ? 'La sede principal no se elimina.' : 'Esta sede tiene usuarios o reservas. Desactívala para conservar el historial.');
        }

        $sede->forceFill(['deleted_at' => now(), 'updated_by' => $actor->getKey()])->save();
        $this->audit->log('Sede', $code, 'eliminar', $sede->name);
    }

    private function values(array $data, ?Sede $current): array
    {
        $name = trim($data['name']);

        if (DB::table('iam_sedes')->whereNull('deleted_at')->whereRaw('lower(name) = ?', [Str::lower($name)])->when($current, fn ($query) => $query->where('id', '<>', $current->getKey()))->exists()) {
            throw ApiException::unprocessable('SED-BR-01', 'Ya existe una sede con ese nombre.');
        }

        $manager = $data['manager_id'] ?? null;
        if ($manager && ! $this->managers()->contains('id', $manager)) {
            throw ApiException::unprocessable('SED-BR-05', 'El responsable debe ser un usuario activo de administración, gerencia, ventas, operaciones o finanzas.');
        }

        return [
            'name' => $name,
            'city' => trim((string) ($data['city'] ?? '')) ?: null,
            'address' => trim($data['address']),
            'phone' => trim((string) ($data['phone'] ?? '')) ?: null,
            'manager_user_id' => $manager,
        ];
    }

    private function sede(string $code): Sede
    {
        return Sede::query()->where('code', $code)->whereNull('deleted_at')->first() ?? throw ApiException::notFound('La sede no existe.');
    }
}
