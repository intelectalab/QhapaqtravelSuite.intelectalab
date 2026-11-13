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
    public const RESPONSES = ['aceptado', 'observado', 'rechazado'];

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
            $this->event($invoice, $result->ok ? '0' : 'ERR', $result->message ?? $result->status, $result->ok ? 'ok' : ($result->errorClass === 'transitorio' ? 'error_temporal' : 'error_definitivo'), null, $actor);

            if (! $result->ok || ! in_array($result->status, self::RESPONSES, true)) {
                return 'emitido';
            }

            return $this->apply($invoice, (string) $result->status, '0', $result->message, $actor);
        });
    }

    public function fromWebhook(string $ticket, string $status, ?string $code, ?string $message): array
    {
        return DB::transaction(function () use ($ticket, $status, $code, $message): array {
            $invoice = DB::table('fin_invoices')->where('ose_ticket', $ticket)->lockForUpdate()->first(['id', 'number', 'status', 'ose_ticket']);

            if ($invoice === null) {
                throw ApiException::notFound('No hay un comprobante con ese ticket del OSE.');
            }

            if ($invoice->status === $status) {
                return ['result' => 'duplicado', 'number' => $invoice->number, 'status' => $status];
            }

            if ($invoice->status !== 'emitido') {
                throw ApiException::conflict('FIN-BR-49', "El comprobante {$invoice->number} ya tiene respuesta del OSE ({$invoice->status}): no se reaplica otra.");
            }

            $this->event($invoice, $code ?? '0', $message ?? $status, 'ok', hash('sha256', "webhook|{$ticket}|{$status}"), null);

            return ['result' => 'aplicado', 'number' => $invoice->number, 'status' => $this->apply($invoice, $status, $code ?? '0', $message, null, ['origen' => 'webhook', 'ticket' => $ticket])];
        });
    }

    private function apply(object $invoice, string $status, string $code, ?string $message, ?User $actor, ?array $evidence = null): string
    {
        DB::table('fin_invoices')->where('id', $invoice->id)->update([
            'status' => $status,
            'ose_response_code' => mb_substr($code, 0, 10),
            'ose_response_message' => $status === 'aceptado' ? 'Aceptado por el OSE' : ($message ?? 'Respuesta del OSE'),
            'ose_responded_at' => now(),
            'lock_version' => DB::raw('lock_version + 1'),
            'updated_by' => $actor?->getKey(),
            'updated_at' => now(),
        ]);
        FinanceHistory::record('invoice', $invoice->id, $status, 'Respuesta del OSE', $actor);
        $this->audit->log('Comprobante', $invoice->number, 'respuesta_ose', 'emitido', $status, evidence: $evidence, actor: $actor);

        return $status;
    }

    private function event(object $invoice, string $code, string $message, string $status, ?string $hash, ?User $actor): void
    {
        DB::table('fin_fiscal_events')->insert([
            'invoice_id' => $invoice->id,
            'action' => 'status',
            'attempt' => DB::table('fin_fiscal_events')->where('invoice_id', $invoice->id)->where('action', 'status')->count() + 1,
            'request_hash' => $hash,
            'response_code' => mb_substr($code, 0, 10),
            'response_message' => $message,
            'status' => $status,
            'created_by' => $actor?->getKey(),
        ]);
    }
}
