<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Admin\Support\TenantSettings;
use App\Domain\Documents\Actions\DownloadDocument;
use App\Domain\Finance\Support\AmountInWords;
use App\Domain\Finance\Support\FinanceHistory;
use App\Domain\Iam\Models\User;
use App\Domain\Integrations\Contracts\FiscalGateway;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Mail\QueuedMail;
use App\Domain\Shared\Outbox\OutboxWriter;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Jobs\SendInvoiceToFiscalProvider;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final class InvoiceFollowUp
{
    public const DEFAULT_VOID_DAYS = 7;

    public function __construct(
        private readonly AuditLogger $audit,
        private readonly OutboxWriter $outbox,
        private readonly QueuedMail $mail,
        private readonly TenantContext $context,
        private readonly FiscalGateway $fiscal,
        private readonly DownloadDocument $downloads,
        private readonly TenantSettings $settings,
    ) {}

    public function voidDays(): int
    {
        $days = (int) ($this->settings->section('currency')['invoice_void_days'] ?? self::DEFAULT_VOID_DAYS);

        return $days > 0 ? $days : self::DEFAULT_VOID_DAYS;
    }

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

    public function void(string $number, string $reason, User $actor): object
    {
        [$result, $invoice] = DB::transaction(function () use ($number, $reason, $actor): array {
            $invoice = $this->locked($number);

            if (! in_array($invoice->status, ['aceptado', 'observado'], true) || ! in_array($invoice->doc_type, ['01', '03'], true)) {
                throw ApiException::conflict('FIN-BR-50', 'Solo se da de baja una factura o boleta aceptada u observada por el OSE.');
            }

            $days = $this->voidDays();

            if (CarbonImmutable::parse((string) $invoice->issue_date)->addDays($days)->toDateString() < CarbonImmutable::now($this->context->timezone())->toDateString()) {
                throw ApiException::unprocessable('FIN-BR-50', 'Venció el plazo para comunicar la baja ('.$days.' días desde la emisión, según la configuración de la agencia). Emite una nota de crédito.');
            }

            if (DB::table('fin_invoices')->where('ref_invoice_id', $invoice->id)->whereNotIn('status', ['rechazado', 'anulado'])->exists()) {
                throw ApiException::conflict('FIN-BR-50', 'El comprobante tiene notas vinculadas: anúlalo con una nota de crédito.');
            }

            $result = $this->fiscal->void((string) $invoice->id, $reason);
            DB::table('fin_fiscal_events')->insert([
                'invoice_id' => $invoice->id,
                'action' => 'void',
                'attempt' => DB::table('fin_fiscal_events')->where('invoice_id', $invoice->id)->where('action', 'void')->count() + 1,
                'request_hash' => hash('sha256', $invoice->number.'|'.$reason),
                'response_code' => $result->ok ? '0' : 'ERR',
                'response_message' => $result->message ?? $result->status,
                'status' => $result->ok ? 'ok' : ($result->errorClass === 'transitorio' ? 'error_temporal' : 'error_definitivo'),
                'created_by' => $actor->getKey(),
            ]);

            if ($result->ok) {
                DB::table('fin_invoices')->where('id', $invoice->id)->update(['status' => 'anulado', 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
                FinanceHistory::record('invoice', $invoice->id, 'anulado', "Comunicación de baja: {$reason}", $actor);
                $this->audit->log('Comprobante', $invoice->number, 'dar_de_baja', $invoice->status, "anulado · {$reason}", actor: $actor);
                $this->outbox->add('fin_invoice', $invoice->id, 'InvoiceVoided', ['invoice_id' => $invoice->id, 'number' => $invoice->number, 'ticket' => $result->externalId]);
            }

            return [$result, $invoice];
        });

        if (! $result->ok) {
            throw ApiException::conflict('FIN-OSE-VOID', 'El OSE no aceptó la baja: '.($result->message ?? 'intenta de nuevo en unos minutos.'));
        }

        return $this->summary((string) $invoice->id);
    }

    public function fiscalFile(string $number, string $kind, User $viewer): array
    {
        $invoice = DB::table('fin_invoices')->where('number', $number)->first(['id', 'number', 'status', 'xml_document_id', 'cdr_document_id'])
            ?? throw ApiException::notFound('El comprobante no existe.');
        $document = $kind === 'xml' ? $invoice->xml_document_id : $invoice->cdr_document_id;

        if ($document === null) {
            throw ApiException::conflict('FIN-FISCAL-FILE', $kind === 'xml'
                ? 'El proveedor fiscal aún no entregó el XML firmado de este comprobante.'
                : 'El OSE aún no entregó la constancia de recepción (CDR) de este comprobante.');
        }

        return ['number' => $invoice->number, 'kind' => $kind, 'status' => $invoice->status, 'url' => $this->downloads->url($viewer, (string) $document), 'expires_in_minutes' => DownloadDocument::URL_MINUTES];
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
