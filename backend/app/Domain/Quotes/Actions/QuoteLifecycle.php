<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Actions;

use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Quotes\Support\QuotePricing;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Throwable;

final class QuoteLifecycle
{
    private const LIVE = ['enviada', 'vista', 'negociacion'];

    public function __construct(private readonly AuditLogger $audit, private readonly TenantContext $context) {}

    public function internalState(object $version): array
    {
        $required = (float) $version->discount_pct > 5 || (float) $version->margin_pct < 15;
        $last = DB::table('quote_internal_approvals')->where('quote_version_id', $version->id)->orderByDesc('created_at')->first(['status', 'request_note', 'decision_note']);

        return ['required' => $required, 'status' => $last?->status, 'note' => $last->decision_note ?? $last?->request_note];
    }

    public function newVersion(string $code, User $actor): void
    {
        [$quote, $version] = $this->load($code, $actor);

        if ($quote->status === 'convertida') {
            throw ApiException::conflict('QTE-BR-18', 'Una cotización convertida en reserva ya no cambia.');
        }

        if ($quote->status === 'borrador') {
            throw ApiException::conflict('QTE-BR-18', 'La versión vigente ya está en borrador: edítala directamente.');
        }

        DB::transaction(function () use ($quote, $version, $actor): void {
            $number = (int) $quote->current_version_no + 1;
            $copy = (array) DB::table('quote_versions')->where('id', $version->id)->first();
            $newId = (string) Str::uuid7();
            unset($copy['id'], $copy['internal_approval_id'], $copy['frozen_at'], $copy['content_hash'], $copy['pdf_document_id']);
            DB::table('quote_versions')->insert([...$copy, 'id' => $newId, 'version_no' => $number, 'status' => 'borrador', 'issued_on' => $this->today(), 'author_id' => $actor->getKey(), 'notes' => null, 'lock_version' => 0, 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey(), 'created_at' => now(), 'updated_at' => now()]);

            foreach (DB::table('quote_items')->where('quote_version_id', $version->id)->get() as $item) {
                $row = (array) $item;
                unset($row['id'], $row['cost_total'], $row['sale_total']);
                DB::table('quote_items')->insert([...$row, 'id' => (string) Str::uuid7(), 'quote_version_id' => $newId, 'created_at' => now(), 'updated_at' => now()]);
            }

            DB::table('quote_versions')->where('id', $version->id)->update(['status' => 'reemplazada']);
            $this->voidInternalApprovals($quote->code, (string) $version->id, 'nueva versión', ['pendiente']);
            DB::table('quote_quotes')->where('id', $quote->id)->update([
                'status' => 'borrador',
                'current_version_no' => $number,
                'current_version_id' => $newId,
                'approved_at' => null,
                'approved_by_name' => null,
                'approval_version_no' => null,
                'rejected_at' => null,
                'rejected_reason' => null,
                'valid_until' => max((string) $quote->valid_until, Carbon::parse($this->today())->addDays(QuoteBuilder::VALIDITY_DAYS)->toDateString()),
                'lock_version' => DB::raw('lock_version + 1'),
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);
            $this->audit->log('Cotización', $quote->code, 'nueva_version', 'v'.$quote->current_version_no, "v{$number}");
        });
    }

    public function voidInternalApprovals(string $quoteCode, string $versionId, string $reason, array $statuses = ['pendiente', 'aprobada']): void
    {
        $voided = DB::table('quote_internal_approvals')->where('quote_version_id', $versionId)->whereIn('status', $statuses)->update(['status' => 'anulada', 'updated_at' => now()]);
        if (in_array('aprobada', $statuses, true)) {
            DB::table('quote_versions')->where('id', $versionId)->whereNotNull('internal_approval_id')->update(['internal_approval_id' => null]);
        }

        if ($voided > 0) {
            $this->audit->log('Cotización', $quoteCode, 'anular_aprobacion_interna', after: $reason);
        }
    }

    public function requestInternal(string $code, string $note, User $actor): void
    {
        [$quote, $version] = $this->load($code, $actor);
        $state = $this->internalState($version);

        if (! $state['required']) {
            throw ApiException::conflict('QTE-BR-11', 'Esta versión no necesita aprobación interna.');
        }

        if ($state['status'] === 'pendiente' || $state['status'] === 'aprobada') {
            throw ApiException::conflict('QTE-BR-15', $state['status'] === 'pendiente' ? 'Ya hay una solicitud pendiente para esta versión.' : 'Esta versión ya está aprobada internamente.');
        }

        DB::table('quote_internal_approvals')->insert([
            'id' => (string) Str::uuid7(),
            'tenant_id' => $this->context->idOrFail(),
            'quote_version_id' => $version->id,
            'reasons' => json_encode($this->reasons($version), JSON_UNESCAPED_UNICODE),
            'over_cap' => (float) $version->discount_pct > QuotePricing::MAX_DISCOUNT,
            'requested_by' => $actor->getKey(),
            'requested_at' => now(),
            'request_note' => $note,
            'status' => 'pendiente',
            'created_by' => $actor->getKey(),
        ]);
        $this->audit->log('Cotización', $quote->code, 'solicitar_aprobacion', after: $note);
    }

    public function decideInternal(string $code, bool $approve, ?string $note, User $actor): void
    {
        if (! $actor->can('quotes.approve_internal')) {
            throw ApiException::forbidden('FORBIDDEN', 'Solo Gerencia aprueba cotizaciones internamente.', ['quotes.approve_internal']);
        }

        [$quote, $version] = $this->load($code, $actor);

        if ($approve && (float) $version->discount_pct > QuotePricing::MAX_DISCOUNT && ! $actor->can('quotes.discount_override')) {
            throw ApiException::forbidden('QTE-BR-14', 'Aprobar un descuento mayor a 10 % requiere el permiso de excepción de descuento.', ['quotes.discount_override']);
        }

        if (! $approve && trim((string) $note) === '') {
            throw ApiException::unprocessable('QTE-BR-15', 'Explica por qué no se aprueba.');
        }

        $pending = DB::table('quote_internal_approvals')->where('quote_version_id', $version->id)->where('status', 'pendiente')->first(['id']);
        $values = ['status' => $approve ? 'aprobada' : 'rechazada', 'decided_by' => $actor->getKey(), 'decided_at' => now(), 'decision_note' => $note, 'is_override' => (float) $version->discount_pct > QuotePricing::MAX_DISCOUNT];

        $id = $pending->id ?? (string) Str::uuid7();

        if ($pending) {
            DB::table('quote_internal_approvals')->where('id', $id)->update($values);
        } else {
            DB::table('quote_internal_approvals')->insert([...$values, 'id' => $id, 'tenant_id' => $this->context->idOrFail(), 'quote_version_id' => $version->id, 'reasons' => json_encode($this->reasons($version), JSON_UNESCAPED_UNICODE), 'over_cap' => $values['is_override'], 'created_by' => $actor->getKey()]);
        }

        DB::table('quote_versions')->where('id', $version->id)->update(['internal_approval_id' => $id]);

        $this->audit->log('Cotización', $quote->code, $approve ? 'aprobar_interna' : 'rechazar_interna', after: $note);
    }

    public function send(string $code, string $channel, string $recipient, ?string $message, User $actor): void
    {
        [$quote, $version] = $this->load($code, $actor);
        $status = $this->effectiveStatus($quote);

        if (! in_array($status, ['borrador', ...self::LIVE], true)) {
            throw ApiException::conflict('QTE-BR-23', $status === 'vencida' ? 'La cotización venció. Crea una nueva versión para volver a enviarla.' : 'Esta cotización ya no se puede enviar.');
        }

        $state = $this->internalState($version);
        if ($state['required'] && $state['status'] !== 'aprobada') {
            throw ApiException::conflict('QTE-BR-12', 'Por el descuento o el margen, Gerencia debe aprobarla antes de enviarla.');
        }

        DB::transaction(function () use ($quote, $version, $channel, $recipient, $message, $actor): void {
            $renew = $quote->status === 'borrador' && $quote->valid_until < $this->today();
            DB::table('quote_sends')->insert(['id' => (string) Str::uuid7(), 'tenant_id' => $this->context->idOrFail(), 'quote_id' => $quote->id, 'version_no' => $quote->current_version_no, 'channel' => $channel, 'recipient' => $recipient, 'message' => $message, 'sent_by' => $actor->getKey(), 'created_by' => $actor->getKey()]);

            if ($quote->status === 'borrador') {
                DB::table('quote_versions')->where('id', $version->id)->update(['status' => 'enviada', 'frozen_at' => now()]);
                DB::table('quote_quotes')->where('id', $quote->id)->update([
                    'status' => 'enviada',
                    'valid_until' => $renew ? Carbon::parse($this->today())->addDays(QuoteBuilder::VALIDITY_DAYS)->toDateString() : $quote->valid_until,
                    'lock_version' => DB::raw('lock_version + 1'),
                    'updated_at' => now(),
                ]);
            }

            $this->audit->log('Cotización', $quote->code, 'enviar', $quote->status, "{$channel} · {$recipient}");
        });

        if ($channel === 'Email') {
            $this->mail($quote, $version, $recipient, $message);
        }
    }

    public function negotiate(string $code, string $channel, string $note, User $actor): void
    {
        [$quote] = $this->load($code, $actor);

        if (! in_array($this->effectiveStatus($quote), self::LIVE, true)) {
            throw ApiException::conflict('QTE-BR-16', 'Solo se registra negociación en una cotización enviada y vigente.');
        }

        DB::transaction(function () use ($quote, $channel, $note, $actor): void {
            DB::table('quote_negotiations')->insert(['id' => (string) Str::uuid7(), 'tenant_id' => $this->context->idOrFail(), 'quote_id' => $quote->id, 'channel' => $channel, 'note' => $note, 'recorded_by' => $actor->getKey(), 'created_by' => $actor->getKey()]);
            DB::table('quote_quotes')->where('id', $quote->id)->update(['status' => 'negociacion', 'lock_version' => DB::raw('lock_version + 1'), 'updated_at' => now()]);

            if ($quote->opportunity_id) {
                DB::table('crm_opportunities')->where('id', $quote->opportunity_id)->whereNotIn('stage', ['ganada', 'perdida', 'negociacion'])->update(['stage' => 'negociacion', 'probability' => 70, 'updated_at' => now()]);
            }

            $this->audit->log('Cotización', $quote->code, 'negociacion', $quote->status, "{$channel} · {$note}");
        });
    }

    public function approve(string $code, array $data, User $actor): void
    {
        if (! $actor->can('reservations.create')) {
            throw ApiException::forbidden('FORBIDDEN', 'Tu rol no registra aprobaciones de clientes.', ['reservations.create']);
        }

        [$quote, $version] = $this->load($code, $actor);
        $status = $this->effectiveStatus($quote);

        if ($status === 'vencida') {
            throw ApiException::conflict('QTE-BR-16', 'La cotización venció. Crea una nueva versión antes de registrar la aprobación.');
        }

        if (! in_array($status, self::LIVE, true)) {
            throw ApiException::conflict('QTE-BR-21', 'Solo se aprueba una cotización enviada al cliente.');
        }

        $state = $this->internalState($version);
        if ($state['required'] && $state['status'] !== 'aprobada') {
            if (! ($data['internal_approval'] ?? false) || ! $actor->can('quotes.approve_internal')) {
                throw ApiException::conflict('QTE-BR-13', 'Falta la aprobación interna de Gerencia.');
            }
            $this->decideInternal($code, true, $data['internal_note'] ?? 'Aprobada al registrar la aprobación del cliente.', $actor);
        }

        DB::transaction(function () use ($quote, $version, $data, $actor): void {
            $now = now();
            $hash = 'sha256:'.hash('sha256', implode('|', [$quote->code, $quote->current_version_no, $version->grand_total, $data['approved_by_name'], $now->toIso8601String()]));
            DB::table('quote_approvals')->insert(['id' => (string) Str::uuid7(), 'tenant_id' => $this->context->idOrFail(), 'quote_id' => $quote->id, 'quote_version_id' => $version->id, 'version_no' => $quote->current_version_no, 'approved_at' => $now, 'approver_name' => $data['approved_by_name'], 'channel' => $data['channel'], 'total' => $version->grand_total, 'currency' => $quote->currency, 'note' => $data['ref'] ?? null, 'evidence_hash' => $hash, 'created_by' => $actor->getKey()]);
            DB::table('quote_versions')->where('id', $version->id)->update(['status' => 'aprobada']);
            DB::table('quote_quotes')->where('id', $quote->id)->update([
                'status' => 'aprobada',
                'approved_at' => $now,
                'approved_by_name' => $data['approved_by_name'],
                'approval_channel' => $data['channel'],
                'approval_ref' => $data['ref'] ?? null,
                'approval_recorded_by' => $actor->getKey(),
                'approval_hash' => Str::limit($hash, 80, ''),
                'approval_version_no' => $quote->current_version_no,
                'lock_version' => DB::raw('lock_version + 1'),
                'updated_at' => $now,
            ]);
            $this->audit->log('Cotización', $quote->code, 'aprobar', $quote->status, "{$data['approved_by_name']} · {$data['channel']}");
        });
    }

    public function reject(string $code, string $reason, User $actor): void
    {
        [$quote, $version] = $this->load($code, $actor);

        if (! in_array($this->effectiveStatus($quote), [...self::LIVE, 'vencida'], true)) {
            throw ApiException::conflict('QTE-BR-17', 'Solo se rechaza una cotización enviada o vencida.');
        }

        DB::transaction(function () use ($quote, $version, $reason): void {
            DB::table('quote_versions')->where('id', $version->id)->update(['status' => 'rechazada']);
            DB::table('quote_quotes')->where('id', $quote->id)->update(['status' => 'rechazada', 'rejected_at' => now(), 'rejected_reason' => $reason, 'lock_version' => DB::raw('lock_version + 1'), 'updated_at' => now()]);
            $this->audit->log('Cotización', $quote->code, 'rechazar', $quote->status, $reason);
        });
    }

    public function delete(string $code, string $reason, User $actor): void
    {
        [$quote] = $this->load($code, $actor);

        if (in_array($quote->status, ['aprobada', 'convertida'], true) || $quote->reservation_id) {
            throw ApiException::conflict('QTE-BR-25', 'Una cotización aprobada o convertida en reserva no se elimina.');
        }

        DB::table('quote_quotes')->where('id', $quote->id)->update(['deleted_at' => now(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Cotización', $quote->code, 'eliminar', $quote->status, $reason);
    }

    private function mail(object $quote, object $version, string $recipient, ?string $message): void
    {
        $agency = $this->context->tenant()->commercial_name;
        $total = ($quote->currency === 'USD' ? 'US$ ' : 'S/ ').number_format((float) $version->grand_total, 2);
        $body = trim(($message ? $message."\n\n" : '')."{$quote->title}\nTotal: {$total}\nVálida hasta: {$quote->valid_until}\n\n{$agency}");

        try {
            Mail::raw($body, fn ($mail) => $mail->to($recipient)->subject("Cotización {$quote->code} · {$agency}"));
        } catch (Throwable $e) {
            report($e);
        }
    }

    private function reasons(object $version): array
    {
        return array_values(array_filter([
            (float) $version->discount_pct > 5 ? "Descuento de {$version->discount_pct} %" : null,
            (float) $version->margin_pct < 15 ? "Margen de {$version->margin_pct} %" : null,
        ]));
    }

    private function effectiveStatus(object $quote): string
    {
        return in_array($quote->status, self::LIVE, true) && $quote->valid_until < $this->today() ? 'vencida' : $quote->status;
    }

    private function load(string $code, User $actor): array
    {
        $quote = Portfolio::scope(DB::table('quote_quotes')->whereNull('deleted_at'), $actor, 'owner_id')->where('code', $code)->first() ?? throw ApiException::notFound('La cotización no existe.');
        $version = DB::table('quote_versions')->where('id', $quote->current_version_id)->first() ?? throw ApiException::conflict('QUOTE_EMPTY', 'La cotización no tiene una versión vigente.');

        return [$quote, $version];
    }

    private function today(): string
    {
        return Carbon::now($this->context->tenant()->timezone ?: 'America/Lima')->toDateString();
    }
}
