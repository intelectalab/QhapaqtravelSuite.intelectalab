<?php

declare(strict_types=1);

namespace App\Domain\SupplierPortal\Actions;

use App\Domain\Operations\Support\OpsNotices;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Concurrency\IfMatch;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\SupplierPortal\Support\SupplierAccount;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class SupplierVouchers
{
    public const EARLY_DAYS = 1;

    public function __construct(private readonly AuditLogger $audit, private readonly OpsNotices $notices, private readonly TenantContext $context) {}

    public function redeem(SupplierAccount $account, string $code, bool $confirmFuture, ?int $version): array
    {
        return DB::transaction(function () use ($account, $code, $confirmFuture, $version): array {
            $code = Str::upper(trim($code));
            $voucher = (clone $account->vouchers())->where('v.code', $code)->lock('for update of v')->first(['v.*', 'r.code as reservation_code'])
                ?? throw ApiException::notFound("El código {$code} no corresponde a un voucher emitido a su establecimiento.");

            if ($version !== null) {
                IfMatch::assertMatches($version, (int) $voucher->lock_version, 'El voucher');
            }

            if ($voucher->status === 'anulado') {
                throw ApiException::conflict('SUP-BR-31', 'Voucher anulado por la agencia: no es válido para el servicio.');
            }

            if ($voucher->status === 'utilizado') {
                $used = Carbon::parse($voucher->used_at)->setTimezone($this->context->timezone())->format('d/m/Y H:i');

                throw ApiException::conflict('SUP-BR-31', "El voucher {$code} ya se utilizó el {$used}. No puede volver a usarse.", ['used_at' => Carbon::parse($voucher->used_at)->toIso8601String()]);
            }

            $days = (int) Carbon::parse(Carbon::now($this->context->timezone())->toDateString())->diffInDays(Carbon::parse($voucher->service_date), false);

            if ($days > self::EARLY_DAYS) {
                throw ApiException::unprocessable('SUP-BR-32', "El servicio es dentro de {$days} días. Solo puede registrar el uso el día del servicio o el anterior.");
            }

            if ($days > 0 && ! $confirmFuture) {
                throw ApiException::unprocessable('SUP-BR-32', 'El servicio es mañana. Registre el uso solo si el huésped ya se presentó y confírmelo.', ['requires_confirmation' => true]);
            }

            DB::table('ops_vouchers')->where('id', $voucher->id)->update(['status' => 'utilizado', 'used_at' => now(), 'used_by' => $account->user->getKey(), 'used_via' => 'extranet', 'updated_by' => $account->user->getKey(), 'updated_at' => now()]);
            $this->audit->log('Voucher', $code, 'check_in_proveedor', 'emitido', 'utilizado');
            $coordinator = DB::table('ops_orders')->where('reservation_id', $voucher->reservation_id)->whereNull('deleted_at')->value('coordinator_id');
            $this->notices->toOperations('voucher.utilizado', "{$code} utilizado en {$account->provider->name} ({$voucher->reservation_code})", $voucher->service_label, 'ops_voucher', $voucher->id, $voucher->reservation_id, $coordinator === null ? null : (string) $coordinator);

            return ['code' => $code, 'service' => $voucher->service_label, 'reservation' => $voucher->reservation_code, 'pax' => (int) $voucher->pax];
        });
    }
}
