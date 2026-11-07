<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Finance\Support\AmountInWords;
use App\Domain\Finance\Support\FinanceHistory;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Mail\QueuedMail;
use App\Domain\Shared\Outbox\OutboxWriter;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Jobs\SendInvoiceToFiscalProvider;
use Illuminate\Support\Facades\DB;

final class InvoiceFollowUp
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly OutboxWriter $outbox,
        private readonly QueuedMail $mail,
        private readonly TenantContext $context,
    ) {}

    public function deliver(string $number, ?string $email, User $actor): object
    {
        return DB::transaction(function () use ($number, $email, $actor): object {
            $invoice = $this->locked($number);

            if ($invoice->status !== 'aceptado') {
                throw ApiException::conflict('FIN-BR-47', 'Solo se entregan comprobantes aceptados por el OSE.');
            }

            $to = $email ?: DB::table('crm_clients')->where('id', $invoice->client_id)->value('email');
            if (! $to) {
                throw ApiException::unprocessable('VALIDATION_ERROR', 'El cliente no tiene correo. Escribe a dónde enviarlo.', ['email' => ['Escribe un correo.']]);
            }

            $agency = $this->context->tenant()->commercial_name;
            $body = "Hola, {$invoice->customer_name}:\n\nTe enviamos tu comprobante electrónico {$invoice->number} por {$invoice->currency} {$invoice->total_amount}.\n{$invoice->amount_in_words}\n\n{$invoice->description}\n\nTambién lo encuentras en tu portal de cliente.\n{$agency}";
            $this->mail->send((string) $to, (string) $invoice->customer_name, "Comprobante electrónico {$invoice->number} · {$agency}", $body);

            DB::table('fin_invoices')->where('id', $invoice->id)->update(['delivered_at' => now(), 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            FinanceHistory::record('invoice', $invoice->id, 'aceptado', "Entregado a {$to}", $actor);
            $this->audit->log('Comprobante', $invoice->number, 'entregar', null, (string) $to, actor: $actor);
            $this->outbox->add('fin_invoice', $invoice->id, 'InvoiceDelivered', ['invoice_id' => $invoice->id, 'number' => $invoice->number]);

            return $this->summary($invoice->id);
        });
    }

    public function resend(string $number, array $data, User $actor): object
    {
        return DB::transaction(function () use ($number, $data, $actor): object {
            $invoice = $this->locked($number);

            if ($invoice->status !== 'observado') {
                throw ApiException::conflict('FIN-BR-49', 'Solo se corrige y reenvía un comprobante observado por el OSE.');
            }

            $values = ['status' => 'pendiente_envio', 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()];
            if (! empty($data['description'])) {
                $values['description'] = mb_substr(trim((string) $data['description']), 0, 500);
                DB::table('fin_invoice_lines')->where('invoice_id', $invoice->id)->update(['description' => $values['description']]);
            }
            if ($invoice->currency !== 'PEN' && ! empty($data['fx_rate'])) {
                $values['fx_rate'] = (string) $data['fx_rate'];
            }
            $values['amount_in_words'] = AmountInWords::of((string) $invoice->total_amount, (string) $invoice->currency);

            DB::table('fin_invoices')->where('id', $invoice->id)->update($values);
            DB::table('fin_fiscal_events')->insert([
                'invoice_id' => $invoice->id,
                'action' => 'resend',
                'attempt' => DB::table('fin_fiscal_events')->where('invoice_id', $invoice->id)->where('action', 'resend')->count() + 1,
                'response_message' => 'Corregido y reenviado',
                'status' => 'ok',
                'created_by' => $actor->getKey(),
            ]);
            FinanceHistory::record('invoice', $invoice->id, 'pendiente_envio', 'Corregido y reenviado', $actor);
            $this->audit->log('Comprobante', $invoice->number, 'reenviar', 'observado', 'pendiente_envio', actor: $actor);
            dispatch((new SendInvoiceToFiscalProvider((string) $invoice->id))->captureTenant())->afterCommit();

            return $this->summary($invoice->id);
        });
    }

    private function locked(string $number): object
    {
        return DB::table('fin_invoices')->where('number', $number)->lockForUpdate()->first()
            ?? throw ApiException::notFound('El comprobante no existe.');
    }

    private function summary(string $id): object
    {
        return DB::table('fin_invoices')->where('id', $id)->first(['number', 'doc_type', 'status', 'currency', 'total_amount', 'delivered_at', 'lock_version']);
    }
}
