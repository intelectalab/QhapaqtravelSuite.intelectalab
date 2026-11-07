<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Finance\Support\FinanceHistory;
use App\Domain\Iam\Models\User;
use App\Domain\Integrations\Contracts\FiscalGateway;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Jobs\SendInvoiceToFiscalProvider;
use Illuminate\Support\Facades\DB;

final class QueryFiscalStatus
{
    public function __construct(private readonly AuditLogger $audit, private readonly FiscalGateway $gateway) {}

    public function __invoke(string $number, User $actor): string
    {
        return DB::transaction(function () use ($number, $actor): string {
            $invoice = DB::table('fin_invoices')->where('number', $number)->lockForUpdate()->first(['id', 'number', 'status', 'ose_ticket']);

            if ($invoice === null) {
                throw ApiException::notFound('El comprobante no existe.');
            }

            if ($invoice->status === 'pendiente_envio') {
                dispatch((new SendInvoiceToFiscalProvider((string) $invoice->id))->captureTenant())->afterCommit();

                return 'pendiente_envio';
            }

            if ($invoice->status !== 'emitido' || $invoice->ose_ticket === null) {
                throw ApiException::conflict('FIN-BR-49', 'Solo se consulta el estado de comprobantes enviados que esperan respuesta.');
            }

            $result = $this->gateway->status((string) $invoice->ose_ticket);
            DB::table('fin_fiscal_events')->insert([
                'invoice_id' => $invoice->id,
                'action' => 'status',
                'attempt' => DB::table('fin_fiscal_events')->where('invoice_id', $invoice->id)->where('action', 'status')->count() + 1,
                'response_code' => $result->ok ? '0' : 'ERR',
                'response_message' => $result->message ?? $result->status,
                'status' => $result->ok ? 'ok' : ($result->errorClass === 'transitorio' ? 'error_temporal' : 'error_definitivo'),
                'created_by' => $actor->getKey(),
            ]);

            if (! $result->ok || ! in_array($result->status, ['aceptado', 'observado', 'rechazado'], true)) {
                return 'emitido';
            }

            DB::table('fin_invoices')->where('id', $invoice->id)->update([
                'status' => $result->status,
                'ose_response_code' => '0',
                'ose_response_message' => $result->status === 'aceptado' ? 'Aceptado por el OSE' : ($result->message ?? 'Respuesta del OSE'),
                'ose_responded_at' => now(),
                'lock_version' => DB::raw('lock_version + 1'),
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);
            FinanceHistory::record('invoice', $invoice->id, $result->status, 'Respuesta del OSE', $actor);
            $this->audit->log('Comprobante', $invoice->number, 'respuesta_ose', 'emitido', $result->status, actor: $actor);

            return $result->status;
        });
    }
}
