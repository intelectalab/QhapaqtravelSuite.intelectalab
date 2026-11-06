<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Operations\Support\VoucherToken;
use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class OperationsVouchersSeeder
{
    use SeedsTenant;

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    protected function shift(): int
    {
        return $this->shiftDays ??= OperationsTimeline::shift($this->tenant) ?? (int) Carbon::parse(self::KIT_TODAY)->diffInDays(Carbon::today(), false);
    }

    public function run(): void
    {
        foreach (KitSeeds::read('vouchers') as $seed) {
            $reservation = DB::table('booking_reservations')->where('tenant_id', $this->tenant->getKey())->where('code', $seed['resId'])->first(['id', 'code', 'cancel_reason']);
            $service = DB::table('booking_reservation_services')->where('tenant_id', $this->tenant->getKey())->where('code', $seed['serviceId'])->first(['id', 'service_time', 'confirmation_code', 'service_date']);
            $providerId = $this->idByCode('catalog_providers', $seed['providerId'], 'ref');

            if ($reservation === null || $service === null || $providerId === null) {
                continue;
            }

            $issuedBy = $this->userId($seed['issuedBy']);
            $issuedAt = $this->moment($seed['issuedAt']);
            $status = $seed['status'];
            $voucherId = $this->upsert('ops_vouchers', ['code' => $seed['id']], [
                'reservation_id' => $reservation->id,
                'reservation_service_id' => $service->id,
                'provider_id' => $providerId,
                'service_label' => $seed['service'],
                'service_date' => $service->service_date,
                'pax' => $seed['pax'],
                'status' => $status,
                'version' => $seed['version'],
                'issued_at' => $issuedAt,
                'issued_by' => $issuedBy,
                'used_at' => $status === 'utilizado' ? Carbon::parse($service->service_date.' '.($service->service_time ?? '08:00'), 'America/Lima')->toIso8601String() : null,
                'used_by' => $status === 'utilizado' ? $issuedBy : null,
                'used_via' => $status === 'utilizado' ? 'extranet' : null,
                'void_reason' => $status === 'anulado' ? ($reservation->cancel_reason ?: 'Reserva cancelada') : null,
                'void_at' => $status === 'anulado' ? $this->moment(Carbon::parse($seed['issuedAt'])->addDays(4)->toDateTimeString()) : null,
                'void_by' => $status === 'anulado' ? $issuedBy : null,
                'origin' => 'operaciones',
                'qr_token' => VoucherToken::make($seed['id'], $reservation->code, (int) $seed['version']),
                'created_by' => $issuedBy,
                'created_at' => $issuedAt,
            ]);

            for ($version = 1; $version <= $seed['version']; $version++) {
                $latest = $version === (int) $seed['version'];
                $this->upsert('ops_voucher_versions', ['voucher_id' => $voucherId, 'version' => $version], [
                    'issued_at' => $latest ? $issuedAt : $this->moment(Carbon::parse($seed['issuedAt'])->subDays(6)->toDateTimeString()),
                    'issued_by' => $issuedBy,
                    'reason' => $version === 1 ? 'Emisión inicial' : 'Reemisión con datos actualizados del servicio',
                    'snapshot' => json_encode([
                        'service' => $seed['service'],
                        'date' => $service->service_date,
                        'time' => $service->service_time ? substr($service->service_time, 0, 5) : null,
                        'provider' => $seed['providerId'],
                        'pax' => $seed['pax'],
                        'confirmation_code' => $service->confirmation_code,
                    ], JSON_UNESCAPED_UNICODE),
                    'created_by' => $issuedBy,
                ]);
            }
        }
    }
}
