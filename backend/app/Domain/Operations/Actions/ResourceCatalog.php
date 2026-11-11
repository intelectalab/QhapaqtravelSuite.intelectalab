<?php

declare(strict_types=1);

namespace App\Domain\Operations\Actions;

use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Iam\Models\User;
use App\Domain\Operations\Support\OpsCommon;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ResourceCatalog
{
    public const TABLES = ['guide' => 'ops_guides', 'driver' => 'ops_drivers', 'vehicle' => 'ops_vehicles'];

    private const LABELS = ['guide' => 'Guía', 'driver' => 'Conductor', 'vehicle' => 'Vehículo'];

    private const COLUMNS = ['guide' => 'guide_id', 'driver' => 'driver_id', 'vehicle' => 'vehicle_id'];

    public function __construct(private readonly CodeSequence $sequence, private readonly AuditLogger $audit, private readonly OpsCommon $common) {}

    public function save(string $type, ?string $id, array $data, User $actor): string
    {
        $table = self::TABLES[$type];
        $values = match ($type) {
            'guide' => [
                'full_name' => $data['full_name'],
                'languages' => '{'.implode(',', array_unique($data['languages'])).'}',
                'license_number' => $data['license_number'],
                'rating' => $data['rating'] ?? null,
                'phone' => $data['phone'] ?? null,
                'status' => $data['status'],
            ],
            'driver' => [
                'full_name' => $data['full_name'],
                'license_number' => $data['license_number'],
                'license_class' => $data['license_class'] ?? null,
                'license_expires_on' => $data['license_expires_on'],
                'phone' => $data['phone'] ?? null,
                'status' => $data['status'],
            ],
            default => [
                'plate' => Str::upper($data['plate']),
                'vehicle_type' => $data['vehicle_type'],
                'capacity' => (int) $data['capacity'],
                'provider_id' => $data['provider_id'] ?? null,
                'soat_expires_on' => $data['soat_expires_on'],
                'status' => $data['status'],
            ],
        };

        if ($type === 'vehicle' && DB::table($table)->where('plate', $values['plate'])->when($id, fn ($query) => $query->where('id', '<>', $id))->exists()) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'Ya hay un vehículo con esa placa.');
        }

        $linking = $type !== 'vehicle' && array_key_exists('user_id', $data);

        if ($linking) {
            $this->assertLinkable($type, $data['user_id'] ?? null, $id);
        }

        if ($id === null) {
            $id = (string) Str::uuid7();
            $key = $type === 'vehicle' ? [] : ['code' => $this->sequence->next($table, $type === 'guide' ? 'G' : 'C', 2)];
            DB::table($table)->insert(['id' => $id, ...$key, ...$values, 'created_by' => $actor->getKey()]);
            $this->audit->log(self::LABELS[$type], $values['plate'] ?? $key['code'], 'crear', null, $values['full_name'] ?? $values['vehicle_type']);

            if ($linking) {
                $this->link($type, $id, $key['code'], null, $data['user_id'] ?? null, $actor);
            }

            return $id;
        }

        $current = $this->find($type, $id);
        DB::table($table)->where('id', $id)->update([...$values, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log(self::LABELS[$type], $current->plate ?? $current->code, 'editar', $current->status, $values['status']);

        if ($linking) {
            $this->link($type, $id, (string) $current->code, $current->user_id, $data['user_id'] ?? null, $actor);
        }

        return $id;
    }

    public static function linkableUsers(string $type): array
    {
        $column = self::COLUMNS[$type];

        return DB::table('iam_users as u')
            ->join('model_has_roles as mr', 'mr.model_id', '=', 'u.id')
            ->join('roles as r', 'r.id', '=', 'mr.role_id')
            ->leftJoin(self::TABLES[$type].' as res', fn ($join) => $join->on('res.id', '=', "u.{$column}")->whereNull('res.deleted_at'))
            ->whereNull('u.deleted_at')
            ->where('u.status', 'activo')
            ->where('r.name', $type)
            ->orderBy('u.name')
            ->get(['u.id', 'u.code', 'u.name', 'u.email', 'res.id as resource_id', 'res.full_name as resource_name'])
            ->map(fn (object $row): array => ['value' => $row->id, 'label' => $row->name, 'hint' => $row->email, 'resource_id' => $row->resource_id, 'resource_name' => $row->resource_name])
            ->values()
            ->all();
    }

    private function assertLinkable(string $type, ?string $userId, ?string $id): void
    {
        if ($userId === null) {
            return;
        }

        $user = collect(self::linkableUsers($type))->firstWhere('value', $userId);

        if ($user === null) {
            throw ApiException::unprocessable('MOB-BR-13', $type === 'guide' ? 'Elige un usuario activo con el rol Guía.' : 'Elige un usuario activo con el rol Conductor.');
        }

        if ($user['resource_id'] !== null && $user['resource_id'] !== $id) {
            throw ApiException::conflict('MOB-BR-13', "{$user['label']} ya está vinculado a {$user['resource_name']}. Desvincúlalo primero.");
        }
    }

    private function link(string $type, string $id, string $code, ?string $previous, ?string $userId, User $actor): void
    {
        if ($previous === $userId) {
            return;
        }

        $column = self::COLUMNS[$type];
        DB::table('iam_users')->where($column, $id)->update([$column => null, 'updated_at' => now()]);
        DB::table(self::TABLES[$type])->where('id', $id)->update(['user_id' => $userId, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);

        if ($userId !== null) {
            DB::table('iam_users')->where('id', $userId)->update([$column => $id, 'updated_at' => now()]);
        }

        $names = DB::table('iam_users')->whereIn('id', array_filter([$previous, $userId]))->pluck('name', 'id');
        $this->audit->log(self::LABELS[$type], $code, $userId === null ? 'desvincular_usuario' : 'vincular_usuario', $previous ? ($names[$previous] ?? null) : null, $userId ? ($names[$userId] ?? null) : null);
    }

    public function archive(string $type, string $id, User $actor): void
    {
        $current = $this->find($type, $id);
        $upcoming = DB::table('ops_assignments as a')->join('ops_orders as o', 'o.id', '=', 'a.order_id')
            ->where('a.'.self::COLUMNS[$type], $id)->whereNotIn('a.status', ['completada'])->whereNotIn('o.status', ['cancelada', 'completada'])
            ->where('a.service_date', '>=', $this->common->today())->count();

        if ($upcoming > 0) {
            throw ApiException::conflict('OPS-BR-24', "Tiene {$upcoming} servicio(s) por delante. Libéralos o reasígnalos antes de darlo de baja.");
        }

        if ($type !== 'vehicle') {
            DB::table('iam_users')->where(self::COLUMNS[$type], $id)->update([self::COLUMNS[$type] => null, 'updated_at' => now()]);
        }

        DB::table(self::TABLES[$type])->where('id', $id)->update([...($type !== 'vehicle' ? ['user_id' => null] : []), 'deleted_at' => now(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log(self::LABELS[$type], $current->plate ?? $current->code, 'desactivar', $current->status, null);
    }

    private function find(string $type, string $id): object
    {
        if (! Str::isUuid($id)) {
            throw ApiException::notFound('El recurso no existe.');
        }

        return DB::table(self::TABLES[$type])->whereNull('deleted_at')->where('id', $id)->first() ?? throw ApiException::notFound('El recurso no existe.');
    }
}
