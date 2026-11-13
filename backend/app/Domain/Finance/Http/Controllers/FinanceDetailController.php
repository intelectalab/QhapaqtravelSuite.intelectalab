<?php

declare(strict_types=1);

namespace App\Domain\Finance\Http\Controllers;

use App\Domain\Finance\Http\Controllers\Concerns\ResolvesActor;
use App\Domain\Finance\Support\FinanceDetails;
use App\Domain\Finance\Support\FinanceNotices;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class FinanceDetailController
{
    use ResolvesActor;

    public function __construct(private readonly FinanceDetails $details) {}

    public function receivable(Request $request, string $code): JsonResponse
    {
        return response()->json(['data' => $this->details->receivable($code, $this->actor($request)) ?? throw ApiException::notFound('La cuota no existe.')]);
    }

    public function payment(Request $request, string $code): JsonResponse
    {
        return response()->json(['data' => $this->details->payment($code, $this->actor($request)) ?? throw ApiException::notFound('El pago no existe.')]);
    }

    public function payable(Request $request, string $code): JsonResponse
    {
        return response()->json(['data' => $this->details->payable($code, $this->actor($request)) ?? throw ApiException::notFound('La obligación no existe.')]);
    }

    public function commission(Request $request, string $code): JsonResponse
    {
        return response()->json(['data' => $this->details->commission($code, $this->actor($request)) ?? throw ApiException::notFound('La comisión no existe.')]);
    }

    public function settlement(string $code): JsonResponse
    {
        return response()->json(['data' => $this->details->settlement($code) ?? throw ApiException::notFound('La reserva no existe.')]);
    }

    public function closeSettlement(Request $request, string $code, AuditLogger $audit, TenantContext $context, FinanceNotices $notices): JsonResponse
    {
        $actor = $this->actor($request);
        $this->requireOperator($actor);

        $result = DB::transaction(function () use ($code, $actor, $audit, $context, $notices): array {
            $reservation = DB::table('booking_reservations')->where('code', $code)->whereNull('deleted_at')->lock('for no key update')->first(['id', 'code']) ?? throw ApiException::notFound('La reserva no existe.');
            $settlement = $this->details->settlement($code) ?? throw ApiException::notFound('La reserva no existe.');

            if ($settlement['closed'] !== null) {
                throw ApiException::conflict('FIN-BR-37', 'La liquidación de esta reserva ya está cerrada.');
            }

            $pending = collect($settlement['checks'])->reject(fn (array $check): bool => $check['ok'])->pluck('label')->all();
            if ($pending !== []) {
                throw ApiException::conflict('FIN-BR-36', 'Aún no se puede liquidar: '.mb_strtolower(implode(', ', $pending)).'.', ['pending' => $pending]);
            }

            $statement = $settlement['statement'];
            DB::table('fin_settlements')->insert([
                'id' => (string) Str::uuid7(), 'tenant_id' => $context->idOrFail(), 'reservation_id' => $reservation->id, 'closed_at' => now(), 'closed_by' => $actor->getKey(),
                'income_pen' => $statement['income'], 'cost_pen' => $statement['cost'], 'commissions_pen' => $statement['commissions'], 'net_pen' => $statement['net'],
                'gross_margin_pct' => $statement['margin_pct'], 'snapshot' => json_encode($settlement, JSON_UNESCAPED_UNICODE), 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey(),
            ]);
            $audit->log('Liquidación de reserva', $reservation->code, 'cerrar', null, "neto S/ {$statement['net']}");
            $notices->settled((string) $reservation->id, $statement['net']);

            return $statement;
        });

        return response()->json(['data' => $result], 201);
    }
}
