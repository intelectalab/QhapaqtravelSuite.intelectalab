<?php

declare(strict_types=1);

namespace App\Domain\Operations\Actions;

use App\Domain\Iam\Models\User;
use App\Domain\Operations\Support\OpsCommon;
use App\Domain\Operations\Support\VoucherToken;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Sequences\SequenceService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class VoucherWorkflow
{
    public function __construct(private readonly SequenceService $sequences, private readonly AuditLogger $audit) {}

    public function issue(string $serviceCode, ?string $providerId, ?string $note, User $actor): string
    {
        return DB::transaction(function () use ($serviceCode, $providerId, $note, $actor): string {
            $service = DB::table('booking_reservation_services as s')
                ->join('booking_reservations as r', 'r.id', '=', 's.reservation_id')
                ->leftJoin('catalog_products as pr', 'pr.id', '=', 's.product_id')
                ->where('s.code', $serviceCode)->lock('for update of s')
                ->first(['s.id', 's.name', 's.service_date', 's.service_time', 's.status', 's.confirmation_code', 's.provider_id', 'pr.main_provider_id', 'r.id as reservation_id', 'r.code as reservation_code', 'r.status as reservation_status'])
                ?? throw ApiException::notFound('El servicio no existe.');

            if (in_array($service->reservation_status, ['cancelada', 'borrador'], true)) {
                throw ApiException::unprocessable('OPS-BR-47', 'La reserva está cancelada o en borrador: no se emiten vouchers.');
            }

            if (! in_array($service->status, ['confirmado', 'completado'], true)) {
                throw ApiException::unprocessable('OPS-BR-40', 'Solo los servicios confirmados por el proveedor emiten voucher.');
            }

            if (DB::table('ops_vouchers')->where('reservation_service_id', $service->id)->whereIn('status', ['emitido', 'utilizado'])->exists()) {
                throw ApiException::conflict('OPS-BR-41', 'Este servicio ya tiene un voucher vigente. Para cambios, emite una nueva versión.');
            }

            $providerId = $service->provider_id ?? $service->main_provider_id ?? $providerId;
            $provider = $providerId && Str::isUuid($providerId) ? DB::table('catalog_providers')->whereNull('deleted_at')->where('id', $providerId)->first(['id', 'name', 'status']) : null;

            if ($provider === null) {
                throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige el proveedor que prestará el servicio.');
            }

            if ($provider->status !== 'activo') {
                throw ApiException::unprocessable('OPS-BR-42', "{$provider->name} no tiene contrato vigente: no se puede emitir el voucher.");
            }

            $pax = DB::table('booking_passengers')->where('reservation_id', $service->reservation_id)->count();
            $code = $this->sequences->next('voucher', year: (int) substr((string) $service->service_date, 0, 4));
            $voucherId = (string) Str::uuid7();
            DB::table('ops_vouchers')->insert([
                'id' => $voucherId,
                'code' => $code,
                'reservation_id' => $service->reservation_id,
                'reservation_service_id' => $service->id,
                'provider_id' => $provider->id,
                'service_label' => $service->name,
                'service_date' => $service->service_date,
                'pax' => max(1, $pax),
                'status' => 'emitido',
                'version' => 1,
                'issued_at' => now(),
                'issued_by' => $actor->getKey(),
                'note' => $note,
                'origin' => 'operaciones',
                'qr_token' => VoucherToken::make($code, $service->reservation_code, 1),
                'created_by' => $actor->getKey(),
            ]);
            $this->snapshot($voucherId, 1, 'Emisión inicial', $service, $provider->name, $pax, $actor);
            $this->audit->log('Voucher', $code, 'emitir', null, "{$service->reservation_code} · {$service->name}");

            return $code;
        });
    }

    public function newVersion(string $code, string $reason, User $actor): void
    {
        $voucher = $this->current($code);
        $service = DB::table('booking_reservation_services')->where('id', $voucher->reservation_service_id)->first(['id', 'name', 'service_date', 'service_time', 'status', 'confirmation_code']);

        if ($service === null || ! in_array($service->status, ['confirmado', 'completado'], true)) {
            throw ApiException::unprocessable('OPS-BR-44', 'El servicio ya no está confirmado: no se puede versionar el voucher.');
        }

        $version = (int) $voucher->version + 1;
        $provider = (string) DB::table('catalog_providers')->where('id', $voucher->provider_id)->value('name');
        $pax = DB::table('booking_passengers')->where('reservation_id', $voucher->reservation_id)->count();
        $reservation = (string) DB::table('booking_reservations')->where('id', $voucher->reservation_id)->value('code');

        DB::transaction(function () use ($voucher, $service, $version, $reason, $provider, $pax, $reservation, $actor): void {
            DB::table('ops_vouchers')->where('id', $voucher->id)->update([
                'version' => $version,
                'service_label' => $service->name,
                'service_date' => $service->service_date,
                'pax' => max(1, $pax),
                'issued_at' => now(),
                'issued_by' => $actor->getKey(),
                'qr_token' => VoucherToken::make($voucher->code, $reservation, $version),
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);
            $this->snapshot($voucher->id, $version, $reason, $service, $provider, $pax, $actor);
        });

        $this->audit->log('Voucher', $code, 'versionar', 'v'.$voucher->version, "v{$version} · {$reason}");
    }

    public function redeem(string $code, User $actor): void
    {
        $voucher = $this->current($code);
        DB::table('ops_vouchers')->where('id', $voucher->id)->update(['status' => 'utilizado', 'used_at' => now(), 'used_by' => $actor->getKey(), 'used_via' => 'web', 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Voucher', $code, 'marcar_utilizado', 'emitido', 'utilizado');
    }

    public function void(string $code, string $reason, User $actor): void
    {
        $voucher = $this->current($code);
        DB::table('ops_vouchers')->where('id', $voucher->id)->update(['status' => 'anulado', 'void_reason' => $reason, 'void_at' => now(), 'void_by' => $actor->getKey(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Voucher', $code, 'anular', 'emitido', $reason);
    }

    private function current(string $code): object
    {
        $voucher = DB::table('ops_vouchers')->where('code', $code)->first() ?? throw ApiException::notFound('El voucher no existe.');

        if ($voucher->status !== 'emitido') {
            throw ApiException::conflict('OPS-BR-45', 'Solo se gestionan vouchers vigentes (emitidos).');
        }

        return $voucher;
    }

    private function snapshot(string $voucherId, int $version, string $reason, object $service, string $provider, int $pax, User $actor): void
    {
        DB::table('ops_voucher_versions')->insert([
            'voucher_id' => $voucherId,
            'version' => $version,
            'issued_at' => now(),
            'issued_by' => $actor->getKey(),
            'reason' => $reason,
            'snapshot' => json_encode([
                'service' => $service->name,
                'date' => $service->service_date,
                'time' => OpsCommon::time($service->service_time),
                'provider' => $provider,
                'pax' => $pax,
                'confirmation_code' => $service->confirmation_code,
            ], JSON_UNESCAPED_UNICODE),
            'created_by' => $actor->getKey(),
        ]);
    }
}
