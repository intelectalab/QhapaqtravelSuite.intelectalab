<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use App\Domain\SupplierPortal\Actions\SupplierRateRequests;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class SupplierPortalSeeder
{
    use SeedsTenant;

    private const REQUESTED = ['solicitado', 'confirmado', 'rechazado', 'en_curso', 'completado'];

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        DB::table('iam_users')->where('tenant_id', $this->tenant->getKey())->whereNotNull('provider_id')->whereNull('provider_role')->update(['provider_role' => 'admin']);
        $this->seedSupplierRequests();
        $this->seedRateRequests();
    }

    private function seedSupplierRequests(): void
    {
        $kit = collect(KitSeeds::read('reservations'))->flatMap(fn (array $reservation): array => collect($reservation['services'] ?? [])->map(fn (array $service): array => [...$service, 'createdAt' => $reservation['createdAt'] ?? null])->all())->keyBy('id');
        $services = DB::table('booking_reservation_services as s')->join('booking_reservations as r', 'r.id', '=', 's.reservation_id')
            ->where('s.tenant_id', $this->tenant->getKey())->whereNotNull('s.provider_id')->whereIn('s.status', self::REQUESTED)
            ->get(['s.id', 's.code', 's.provider_id', 's.status', 's.confirmation_code', 's.reject_reason', 's.requested_at', 's.requested_by', 's.confirmed_at', 's.rooms', 's.nights', 'r.created_at as reservation_created']);

        foreach ($services as $service) {
            $seed = $kit[$service->code] ?? [];
            $requestedAt = $service->requested_at ?? $this->moment($seed['requestedAt'] ?? null) ?? Carbon::parse($service->reservation_created)->addHours(2)->toIso8601String();
            $requestedBy = $service->requested_by ?? $this->userId($seed['requestedBy'] ?? 'U06');
            $patch = array_filter([
                'requested_at' => $service->requested_at === null ? $requestedAt : null,
                'requested_by' => $service->requested_by === null ? $requestedBy : null,
                'rooms' => $service->rooms === null ? ($seed['rooms'] ?? null) : null,
                'nights' => $service->nights === null ? ($seed['nights'] ?? null) : null,
            ], fn ($value): bool => $value !== null);

            if ($patch !== []) {
                DB::table('booking_reservation_services')->where('id', $service->id)->update($patch);
            }

            $open = $service->status === 'solicitado';
            $respondedAt = $open ? null : ($service->confirmed_at ?? Carbon::parse($requestedAt)->addHours(6)->toIso8601String());
            $this->upsert('ops_supplier_requests', ['reservation_service_id' => $service->id], [
                'provider_id' => $service->provider_id,
                'status' => match ($service->status) {
                    'solicitado' => 'solicitado',
                    'rechazado' => 'rechazado',
                    default => 'confirmado',
                },
                'channel' => $open ? 'extranet' : 'email',
                'requested_at' => $requestedAt,
                'requested_by' => $requestedBy,
                'responded_at' => $respondedAt,
                'response_source' => $open ? null : 'web_interno',
                'confirmation_code' => $service->status === 'rechazado' ? null : $service->confirmation_code,
                'rejection_reason' => $service->status === 'rechazado' ? Str::limit((string) ($service->reject_reason ?: 'Otro'), 120, '') : null,
                'created_by' => $requestedBy,
                'updated_by' => $requestedBy,
                'created_at' => $requestedAt,
                'updated_at' => $respondedAt ?? $requestedAt,
            ]);
        }
    }

    private function seedRateRequests(): void
    {
        foreach (KitSeeds::read('providerRequests') as $seed) {
            $providerId = $this->idByCode('catalog_providers', $seed['providerId'], 'ref');
            $serviceId = $this->idByCode('catalog_services', $seed['serviceId'], 'ref');

            if ($providerId === null || $serviceId === null) {
                continue;
            }

            $type = collect(SupplierRateRequests::REASONS)->first(fn (string $reason): bool => str_starts_with($seed['reason'], $reason)) ?? 'Otro';
            $detail = trim(Str::after($seed['reason'], $type === 'Otro' ? '' : $type), " :\u{00A0}") ?: null;
            $requester = $this->userId($seed['user'] ?? 'U05');
            $requestedAt = $this->moment($seed['ts']);
            $this->upsert('supplier_rate_requests', ['code' => $seed['id']], [
                'provider_id' => $providerId,
                'service_id' => $serviceId,
                'current_cost' => $seed['current'],
                'proposed_cost' => $seed['proposed'],
                'currency' => $seed['currency'],
                'effective_from' => $this->day($seed['from']),
                'reason_type' => $type,
                'reason_detail' => $detail,
                'status' => $seed['status'],
                'requested_by' => $requester,
                'requested_at' => $requestedAt,
                'created_by' => $requester,
                'updated_by' => $requester,
                'created_at' => $requestedAt,
                'updated_at' => $requestedAt,
            ]);
        }
    }
}
