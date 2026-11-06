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

        if ($id === null) {
            $id = (string) Str::uuid7();
            $key = $type === 'vehicle' ? [] : ['code' => $this->sequence->next($table, $type === 'guide' ? 'G' : 'C', 2)];
            DB::table($table)->insert(['id' => $id, ...$key, ...$values, 'created_by' => $actor->getKey()]);
            $this->audit->log(self::LABELS[$type], $values['plate'] ?? $key['code'], 'crear', null, $values['full_name'] ?? $values['vehicle_type']);

            return $id;
        }

        $current = $this->find($type, $id);
        DB::table($table)->where('id', $id)->update([...$values, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log(self::LABELS[$type], $current->plate ?? $current->code, 'editar', $current->status, $values['status']);

        return $id;
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

        DB::table(self::TABLES[$type])->where('id', $id)->update(['deleted_at' => now(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
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
