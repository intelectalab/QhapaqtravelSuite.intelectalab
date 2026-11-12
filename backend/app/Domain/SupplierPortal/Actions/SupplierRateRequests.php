<?php

declare(strict_types=1);

namespace App\Domain\SupplierPortal\Actions;

use App\Domain\Catalog\Support\CatalogAccess;
use App\Domain\Catalog\Support\ServiceDirectory;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\SupplierPortal\Support\SupplierAccount;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class SupplierRateRequests
{
    public const REASONS = ['Ajuste por inflación / costos', 'Cambio de temporada', 'Mejora del servicio', 'Tarifa promocional', 'Otro'];

    public const NOTICE_DAYS = 30;

    public function __construct(private readonly CodeSequence $codes, private readonly AuditLogger $audit, private readonly TenantContext $context) {}

    public function create(SupplierAccount $account, array $data): string
    {
        return DB::transaction(function () use ($account, $data): string {
            $service = $account->catalogService($data['service']);

            if (ServiceDirectory::serviceState($service, CatalogAccess::today()) !== 'activo') {
                throw ApiException::unprocessable('SUP-BR-61', 'Solo puede actualizar la tarifa de un servicio activo.');
            }

            $this->validate($service, $data);

            if (DB::table('supplier_rate_requests')->where('service_id', $service->id)->where('status', 'pendiente')->lockForUpdate()->exists()) {
                throw ApiException::conflict('SUP-BR-61', 'Ya hay una actualización pendiente para este servicio. Espere la respuesta de la agencia o retírela.');
            }

            $code = $this->codes->next('supplier_rate_requests', 'SOL-TAR-', 4);
            DB::table('supplier_rate_requests')->insert([
                'code' => $code,
                'provider_id' => $account->id(),
                'service_id' => $service->id,
                'current_cost' => $service->cost,
                'proposed_cost' => round((float) $data['proposed_cost'], 2),
                'currency' => $service->currency,
                'effective_from' => $data['effective_from'],
                'reason_type' => $data['reason_type'],
                'reason_detail' => $data['reason_detail'] ?? null,
                'status' => 'pendiente',
                'requested_by' => $account->user->getKey(),
                'requested_at' => now(),
                'created_by' => $account->user->getKey(),
                'updated_by' => $account->user->getKey(),
            ]);
            $this->audit->log('Tarifa proveedor', $service->ref, 'solicitud_actualizacion', "{$service->currency} {$service->cost}", "{$service->currency} {$data['proposed_cost']} desde {$data['effective_from']} ({$code})");

            return $code;
        });
    }

    public function update(SupplierAccount $account, string $code, array $data): void
    {
        DB::transaction(function () use ($account, $code, $data): void {
            $request = $this->pending($account, $code);
            $service = DB::table('catalog_services')->where('id', $request->service_id)->first() ?? throw ApiException::notFound();
            $this->validate($service, $data);
            DB::table('supplier_rate_requests')->where('id', $request->id)->update([
                'proposed_cost' => round((float) $data['proposed_cost'], 2),
                'effective_from' => $data['effective_from'],
                'reason_type' => $data['reason_type'],
                'reason_detail' => $data['reason_detail'] ?? null,
                'updated_by' => $account->user->getKey(),
                'updated_at' => now(),
            ]);
            $this->audit->log('Tarifa proveedor', $service->ref, 'editar_solicitud', "{$request->currency} {$request->proposed_cost} desde {$request->effective_from}", "{$request->currency} {$data['proposed_cost']} desde {$data['effective_from']} ({$code})");
        });
    }

    public function withdraw(SupplierAccount $account, string $code): void
    {
        DB::transaction(function () use ($account, $code): void {
            $request = $this->pending($account, $code);
            DB::table('supplier_rate_requests')->where('id', $request->id)->update(['status' => 'retirada', 'updated_by' => $account->user->getKey(), 'updated_at' => now()]);
            $this->audit->log('Tarifa proveedor', $code, 'retirar_solicitud', 'pendiente', 'retirada');
        });
    }

    public function earliest(): string
    {
        return Carbon::now($this->context->timezone())->addDays(self::NOTICE_DAYS)->toDateString();
    }

    private function validate(object $service, array $data): void
    {
        if (round((float) $data['proposed_cost'], 2) === round((float) $service->cost, 2)) {
            throw ApiException::unprocessable('SUP-BR-61', 'La tarifa propuesta es igual a la vigente.');
        }

        if ($data['effective_from'] < $this->earliest()) {
            throw ApiException::unprocessable('SUP-BR-61', 'La nueva tarifa rige como mínimo '.self::NOTICE_DAYS.' días después de la solicitud.');
        }
    }

    private function pending(SupplierAccount $account, string $code): object
    {
        $request = $account->rateRequest($code);
        DB::table('supplier_rate_requests')->where('id', $request->id)->lockForUpdate()->first(['id']);

        if ($request->status !== 'pendiente') {
            throw ApiException::conflict('SUP-BR-61', 'La solicitud ya fue revisada por la agencia y no se puede cambiar.');
        }

        return $request;
    }
}
