<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Actions;

use App\Domain\Catalog\Support\CatalogAccess;
use App\Domain\Iam\Models\User;
use App\Domain\Inbox\Support\OriginClosure;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ProviderRateReview
{
    public function __construct(private readonly AuditLogger $audit, private readonly OriginClosure $origin) {}

    public function approve(string $code, ?string $note, User $actor): string
    {
        return DB::transaction(function () use ($code, $note, $actor): string {
            $request = $this->open($code);
            $service = DB::table('catalog_services')->where('id', $request->service_id)->whereNull('deleted_at')->lockForUpdate()->first()
                ?? throw ApiException::conflict('APR-BR-08', 'El servicio de esta solicitud ya no existe.');
            $today = CatalogAccess::today();
            $from = (string) $request->effective_from;
            $immediate = $from <= $today;
            $cost = round((float) $request->proposed_cost, 2);

            if (trim((string) $service->currency) !== trim((string) $request->currency)) {
                throw ApiException::conflict('APR-BR-08', 'La moneda del servicio cambió desde que se pidió la tarifa. Pide al proveedor una nueva solicitud.');
            }

            $rateId = $this->history($service, $request, $from, $actor);
            $next = DB::table('catalog_service_cost_history')->where('service_id', $service->id)->where('effective_from', '>', $today)->orderBy('effective_from')->first(['cost', 'effective_from']);

            DB::table('catalog_services')->where('id', $service->id)->update([
                ...($immediate ? ['cost' => $cost] : []),
                'scheduled_cost' => $next?->cost,
                'scheduled_cost_from' => $next?->effective_from,
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);
            DB::table('supplier_rate_requests')->where('id', $request->id)->update([
                'status' => 'aprobada',
                'reviewed_by' => $actor->getKey(),
                'reviewed_at' => now(),
                'review_note' => $note,
                'resulting_rate_id' => $rateId,
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);

            $currency = trim((string) $service->currency);
            $uses = DB::table('catalog_product_items')->where('service_id', $service->id)->distinct()->count('product_id');
            $this->audit->log('Servicio', $service->ref, 'cambio_costo', "{$currency} {$service->cost}", "{$currency} {$cost} desde {$from}".($immediate ? '' : ' (programado)')." · usado en {$uses} productos");
            $this->audit->log('Tarifa proveedor', $request->code, 'aprobar_actualizacion', 'pendiente', "aprobada · {$currency} {$cost} desde {$from}");
            $this->origin->close('supplier_rate_requests', $request->code, true, $note, $actor);

            return $immediate ? 'aplicada' : 'programada';
        });
    }

    public function reject(string $code, string $note, User $actor): void
    {
        DB::transaction(function () use ($code, $note, $actor): void {
            $request = $this->open($code);
            DB::table('supplier_rate_requests')->where('id', $request->id)->update([
                'status' => 'rechazada',
                'reviewed_by' => $actor->getKey(),
                'reviewed_at' => now(),
                'review_note' => $note,
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);
            $this->audit->log('Tarifa proveedor', $request->code, 'rechazar_actualizacion', 'pendiente', "rechazada · {$note}");
            $this->origin->close('supplier_rate_requests', $request->code, false, $note, $actor);
        });
    }

    private function history(object $service, object $request, string $from, User $actor): string
    {
        $rows = DB::table('catalog_service_cost_history')->where('service_id', $service->id)->orderBy('effective_from')->get(['id', 'effective_from', 'effective_to']);
        $closeOn = Carbon::parse($from)->subDay()->toDateString();
        $previous = $rows->filter(fn (object $row): bool => (string) $row->effective_from < $from)->last();
        $next = $rows->first(fn (object $row): bool => (string) $row->effective_from > $from);

        if ($rows->isEmpty()) {
            DB::table('catalog_service_cost_history')->insert([
                'service_id' => $service->id,
                'cost' => $service->cost,
                'currency' => $service->currency,
                'effective_from' => min((string) $service->valid_from, $closeOn),
                'effective_to' => $closeOn,
                'source' => 'contrato',
                'created_by' => $actor->getKey(),
            ]);
        } elseif ($previous !== null && ($previous->effective_to === null || (string) $previous->effective_to >= $from)) {
            DB::table('catalog_service_cost_history')->where('id', $previous->id)->update(['effective_to' => $closeOn]);
        }

        $id = (string) Str::uuid7();
        DB::table('catalog_service_cost_history')->insert([
            'id' => $id,
            'service_id' => $service->id,
            'cost' => $request->proposed_cost,
            'currency' => $request->currency,
            'effective_from' => $from,
            'effective_to' => $next ? Carbon::parse((string) $next->effective_from)->subDay()->toDateString() : null,
            'source' => 'solicitud_proveedor',
            'rate_request_id' => $request->id,
            'created_by' => $actor->getKey(),
        ]);

        return $id;
    }

    private function open(string $code): object
    {
        $request = DB::table('supplier_rate_requests')->where('code', $code)->lockForUpdate()->first() ?? throw ApiException::notFound('La solicitud de tarifa no existe.');

        if ($request->status !== 'pendiente') {
            throw ApiException::conflict('APR-BR-08', $request->status === 'retirada' ? 'El proveedor retiró esta solicitud.' : 'La solicitud de tarifa ya fue revisada.');
        }

        return $request;
    }
}
