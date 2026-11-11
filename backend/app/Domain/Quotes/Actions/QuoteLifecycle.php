<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Actions;

use App\Domain\Crm\Support\Advisors;
use App\Domain\Iam\Models\User;
use App\Domain\Quotes\Enums\QuoteStatus;
use App\Domain\Quotes\Models\Quote;
use App\Domain\Quotes\StateMachines\QuoteStateMachine;
use App\Domain\Quotes\Support\QuoteApprovalPolicy;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Mail\QueuedMail;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Sequences\SequenceService;
use App\Domain\Shared\Tenancy\TenantContext;
use Brick\Math\BigDecimal;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

final class QuoteLifecycle
{
    public const DISCOUNT_LIMIT = '5';

    public const MARGIN_FLOOR = '15';

    private const LIVE = ['enviada', 'vista', 'negociacion'];

    public function __construct(
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
        private readonly QuoteStateMachine $states,
        private readonly SequenceService $sequences,
    ) {}

    public static function discountNeedsApproval(BigDecimal|string|int $discountPct, ?string $limit = null): bool
    {
        return BigDecimal::of((string) $discountPct)->isGreaterThan($limit ?? self::DISCOUNT_LIMIT);
    }

    public static function marginNeedsApproval(BigDecimal|string|int $marginPct, ?string $floor = null): bool
    {
        return BigDecimal::of((string) $marginPct)->isLessThan($floor ?? self::MARGIN_FLOOR);
    }

    public static function needsInternalApproval(BigDecimal|string|int $discountPct, BigDecimal|string|int $marginPct, ?array $limits = null): bool
    {
        return self::discountNeedsApproval($discountPct, $limits['discount_limit'] ?? null) || self::marginNeedsApproval($marginPct, $limits['margin_floor'] ?? null);
    }

    public static function currentLimits(): array
    {
        return app(QuoteApprovalPolicy::class)->limits();
    }

    public function internalState(object $version): array
    {
        $required = self::needsInternalApproval((string) $version->discount_pct, (string) $version->margin_pct, self::currentLimits());
        $last = DB::table('quote_internal_approvals')->where('quote_version_id', $version->id)->orderByDesc('created_at')->first(['status', 'request_note', 'decision_note']);

        return ['required' => $required, 'status' => $last?->status, 'note' => $last->decision_note ?? $last?->request_note];
    }

    public function newVersion(string $code, User $actor): void
    {
        DB::transaction(function () use ($code, $actor): void {
            [$quote, $version] = $this->load($code, $actor);

            if ($quote->status === QuoteStatus::Convertida->value) {
                throw ApiException::conflict('QTE-BR-18', 'Una cotización convertida en reserva ya no cambia.');
            }

            if ($quote->status === QuoteStatus::Borrador->value) {
                throw ApiException::conflict('QTE-BR-18', 'La versión vigente ya está en borrador: edítala directamente.');
            }

            $number = (int) $quote->current_version_no + 1;
            $newId = $this->copyVersion($version, (string) $quote->id, $number, $actor);
            DB::table('quote_versions')->where('id', $version->id)->update(['status' => 'reemplazada']);
            $this->voidInternalApprovals((string) $quote->code, (string) $version->id, 'nueva versión', ['pendiente']);

            $before = $this->states->transition($quote, QuoteStatus::Borrador);
            $quote->forceFill([
                'current_version_no' => $number,
                'current_version_id' => $newId,
                'approved_at' => null,
                'approved_by_name' => null,
                'approval_version_no' => null,
                'rejected_at' => null,
                'rejected_reason' => null,
                'valid_until' => max($quote->valid_until?->toDateString() ?? $this->today(), $this->renewedValidity()),
                'updated_by' => $actor->getKey(),
            ])->save();
            $this->audit->log('Cotización', (string) $quote->code, 'nueva_version', "{$before} · v".($number - 1), "v{$number}");
        });
    }

    public function duplicate(string $code, ?string $note, User $actor): string
    {
        return DB::transaction(function () use ($code, $note, $actor): string {
            [$source, $version] = $this->load($code, $actor, false);
            $opportunity = $source->opportunity_id === null ? null : DB::table('crm_opportunities')->where('id', $source->opportunity_id)->whereNotIn('stage', ['ganada', 'perdida'])->value('id');
            $copy = new Quote;
            $copy->forceFill([
                'code' => $this->sequences->next('quote'),
                'client_id' => $source->client_id,
                'opportunity_id' => $opportunity,
                'owner_id' => $actor->getKey(),
                'title' => mb_substr($source->title, 0, 200),
                'status' => QuoteStatus::Borrador->value,
                'current_version_no' => 1,
                'travel_from' => $source->travel_from,
                'travel_to' => $source->travel_to,
                'valid_until' => $this->renewedValidity(),
                'currency' => $source->currency,
                'fx_rate' => $source->fx_rate,
                'pax_adt' => $source->pax_adt,
                'pax_chd' => $source->pax_chd,
                'pax_inf' => $source->pax_inf,
                'duplicated_from_id' => $source->id,
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ])->save();

            $versionId = $this->copyVersion($version, (string) $copy->id, 1, $actor);
            $copy->forceFill(['current_version_id' => $versionId])->save();
            $this->audit->log('Cotización', (string) $copy->code, 'duplicar', (string) $source->code, trim('v'.$source->current_version_no.' '.(string) $note));

            return (string) $copy->code;
        });
    }

    public function reassign(string $code, string $ownerId, ?string $note, User $actor): void
    {
        if (! $actor->can('crm.records.reassign')) {
            throw ApiException::forbidden('FORBIDDEN', 'Solo Gerencia y la administración reasignan cotizaciones.', ['crm.records.reassign']);
        }

        if (! app(Advisors::class)->has($ownerId)) {
            throw ApiException::unprocessable('QTE-BR-27', 'Elige un asesor activo de la agencia.', ['field' => 'owner_id']);
        }

        DB::transaction(function () use ($code, $ownerId, $note, $actor): void {
            [$quote] = $this->load($code, $actor);

            if ((string) $quote->owner_id === $ownerId) {
                throw ApiException::conflict('QTE-BR-27', 'La cotización ya está a cargo de ese asesor.');
            }

            $before = (string) DB::table('iam_users')->where('id', $quote->owner_id)->value('name');
            $after = (string) DB::table('iam_users')->where('id', $ownerId)->value('name');
            $quote->forceFill(['owner_id' => $ownerId, 'updated_by' => $actor->getKey()])->save();
            $this->audit->log('Cotización', (string) $quote->code, 'reasignar', $before, trim($after.' '.(string) $note));
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
        DB::transaction(function () use ($code, $note, $actor): void {
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
                'over_cap' => $this->overCap($version),
                'requested_by' => $actor->getKey(),
                'requested_at' => now(),
                'request_note' => $note,
                'status' => 'pendiente',
                'created_by' => $actor->getKey(),
            ]);
            $this->audit->log('Cotización', (string) $quote->code, 'solicitar_aprobacion', after: $note);
        });
    }

    public function decideInternal(string $code, bool $approve, ?string $note, User $actor, ?int $versionNo = null): void
    {
        if (! $actor->can('quotes.approve_internal')) {
            throw ApiException::forbidden('FORBIDDEN', 'Solo Gerencia aprueba cotizaciones internamente.', ['quotes.approve_internal']);
        }

        DB::transaction(function () use ($code, $approve, $note, $actor, $versionNo): void {
            [$quote, $version] = $this->load($code, $actor);

            if ($versionNo !== null && $versionNo !== (int) $quote->current_version_no) {
                throw ApiException::conflict('QTE-BR-15', "Solo se decide sobre la versión vigente (v{$quote->current_version_no}).");
            }

            if ($approve && $this->overCap($version) && ! $actor->can('quotes.discount_override')) {
                throw ApiException::forbidden('QTE-BR-14', 'Aprobar un descuento mayor a 10 % requiere el permiso de excepción de descuento.', ['quotes.discount_override']);
            }

            if (! $approve && trim((string) $note) === '') {
                throw ApiException::unprocessable('QTE-BR-15', 'Explica por qué no se aprueba.');
            }

            $pending = DB::table('quote_internal_approvals')->where('quote_version_id', $version->id)->where('status', 'pendiente')->first(['id']);
            $values = ['status' => $approve ? 'aprobada' : 'rechazada', 'decided_by' => $actor->getKey(), 'decided_at' => now(), 'decision_note' => $note, 'is_override' => $this->overCap($version)];
            $id = $pending->id ?? (string) Str::uuid7();

            if ($pending) {
                DB::table('quote_internal_approvals')->where('id', $id)->update($values);
            } else {
                DB::table('quote_internal_approvals')->insert([...$values, 'id' => $id, 'tenant_id' => $this->context->idOrFail(), 'quote_version_id' => $version->id, 'reasons' => json_encode($this->reasons($version), JSON_UNESCAPED_UNICODE), 'over_cap' => $values['is_override'], 'created_by' => $actor->getKey()]);
            }

            DB::table('quote_versions')->where('id', $version->id)->update(['internal_approval_id' => $id]);
            $this->audit->log('Cotización', (string) $quote->code, $approve ? 'aprobar_interna' : 'rechazar_interna', after: $note);
        });
    }

    public function send(string $code, string $channel, string $recipient, ?string $message, User $actor): void
    {
        [$quote, $version] = DB::transaction(function () use ($code, $channel, $recipient, $message, $actor): array {
            [$quote, $version] = $this->load($code, $actor);
            $status = $this->effectiveStatus($quote);

            if (! in_array($status, [QuoteStatus::Borrador->value, ...self::LIVE], true)) {
                throw ApiException::conflict('QTE-BR-23', $status === 'vencida' ? 'La cotización venció. Crea una nueva versión para volver a enviarla.' : 'Esta cotización ya no se puede enviar.');
            }

            $state = $this->internalState($version);
            if ($state['required'] && $state['status'] !== 'aprobada') {
                throw ApiException::conflict('QTE-BR-12', 'Por el descuento o el margen, Gerencia debe aprobarla antes de enviarla.');
            }

            DB::table('quote_sends')->insert(['id' => (string) Str::uuid7(), 'tenant_id' => $this->context->idOrFail(), 'quote_id' => $quote->id, 'version_no' => $quote->current_version_no, 'channel' => $channel, 'recipient' => $recipient, 'message' => $message, 'sent_by' => $actor->getKey(), 'created_by' => $actor->getKey()]);
            $before = (string) $quote->status;

            if ($quote->status === QuoteStatus::Borrador->value) {
                $renew = ($quote->valid_until?->toDateString() ?? $this->today()) < $this->today();
                DB::table('quote_versions')->where('id', $version->id)->update(['status' => 'enviada', 'frozen_at' => now()]);
                $this->states->transition($quote, QuoteStatus::Enviada);
                $quote->forceFill(['valid_until' => $renew ? $this->renewedValidity() : $quote->valid_until, 'updated_by' => $actor->getKey()])->save();
            }

            $this->audit->log('Cotización', (string) $quote->code, 'enviar', $before, "{$channel} · {$recipient}");

            return [$quote, $version];
        });

        if ($channel === 'Email') {
            $this->mail($quote, $version, $recipient, $message);
        }
    }

    public function recordView(string $code, ?string $note, User $actor): void
    {
        DB::transaction(function () use ($code, $note, $actor): void {
            [$quote] = $this->load($code, $actor);

            if (! in_array($this->effectiveStatus($quote), self::LIVE, true)) {
                throw ApiException::conflict('QTE-BR-16', 'Solo se registra la vista de una cotización enviada y vigente.');
            }

            DB::table('quote_views')->insert(['id' => (string) Str::uuid7(), 'tenant_id' => $this->context->idOrFail(), 'quote_id' => $quote->id, 'version_no' => $quote->current_version_no, 'viewed_at' => now(), 'source' => 'manual', 'ip' => request()->ip(), 'user_agent' => request()->userAgent(), 'recorded_by' => $actor->getKey()]);
            $before = (string) $quote->status;

            if ($quote->status === QuoteStatus::Enviada->value) {
                $this->states->transition($quote, QuoteStatus::Vista);
            }

            $quote->forceFill(['viewed_at' => $quote->viewed_at ?? now(), 'updated_by' => $actor->getKey()])->save();
            $this->audit->log('Cotización', (string) $quote->code, 'registrar_vista', $before, $note ?: 'Vista registrada manualmente');
        });
    }

    public function negotiate(string $code, string $channel, string $note, User $actor): void
    {
        DB::transaction(function () use ($code, $channel, $note, $actor): void {
            [$quote] = $this->load($code, $actor);

            if (! in_array($this->effectiveStatus($quote), self::LIVE, true)) {
                throw ApiException::conflict('QTE-BR-16', 'Solo se registra negociación en una cotización enviada y vigente.');
            }

            DB::table('quote_negotiations')->insert(['id' => (string) Str::uuid7(), 'tenant_id' => $this->context->idOrFail(), 'quote_id' => $quote->id, 'channel' => $channel, 'note' => $note, 'recorded_by' => $actor->getKey(), 'created_by' => $actor->getKey()]);
            $before = (string) $quote->status;

            if ($quote->status !== QuoteStatus::Negociacion->value) {
                $this->states->transition($quote, QuoteStatus::Negociacion);
                $quote->forceFill(['updated_by' => $actor->getKey()])->save();
            }

            $opportunity = $quote->opportunity_id ? DB::table('crm_opportunities')->where('id', $quote->opportunity_id)->whereNotIn('stage', ['ganada', 'perdida', 'negociacion'])->first(['id', 'code', 'stage']) : null;

            if ($opportunity) {
                DB::table('crm_opportunities')->where('id', $opportunity->id)->update(['stage' => 'negociacion', 'probability' => 70, 'updated_at' => now()]);
                $this->audit->log('Oportunidad', (string) $opportunity->code, 'cambio_etapa', (string) $opportunity->stage, 'negociacion');
            }

            $this->audit->log('Cotización', (string) $quote->code, 'negociacion', $before, "{$channel} · {$note}");
        });
    }

    public function approve(string $code, array $data, User $actor): void
    {
        if (! $actor->can('reservations.create')) {
            throw ApiException::forbidden('FORBIDDEN', 'Tu rol no registra aprobaciones de clientes.', ['reservations.create']);
        }

        DB::transaction(function () use ($code, $data, $actor): void {
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

            $now = now();
            $hash = 'sha256:'.hash('sha256', implode('|', [$quote->code, $quote->current_version_no, $version->grand_total, $data['approved_by_name'], $now->toIso8601String()]));
            DB::table('quote_approvals')->insert(['id' => (string) Str::uuid7(), 'tenant_id' => $this->context->idOrFail(), 'quote_id' => $quote->id, 'quote_version_id' => $version->id, 'version_no' => $quote->current_version_no, 'approved_at' => $now, 'approver_name' => $data['approved_by_name'], 'channel' => $data['channel'], 'total' => $version->grand_total, 'currency' => $quote->currency, 'note' => $data['ref'] ?? null, 'evidence_hash' => $hash, 'created_by' => $actor->getKey()]);
            DB::table('quote_versions')->where('id', $version->id)->update(['status' => 'aprobada']);
            $before = $this->states->transition($quote, QuoteStatus::Aprobada);
            $quote->forceFill([
                'approved_at' => $now,
                'approved_by_name' => $data['approved_by_name'],
                'approval_channel' => $data['channel'],
                'approval_ref' => $data['ref'] ?? null,
                'approval_recorded_by' => $actor->getKey(),
                'approval_hash' => Str::limit($hash, 80, ''),
                'approval_version_no' => $quote->current_version_no,
                'updated_by' => $actor->getKey(),
            ])->save();
            $this->audit->log('Cotización', (string) $quote->code, 'aprobar', $before, "{$data['approved_by_name']} · {$data['channel']}");
        });
    }

    public function reject(string $code, string $reason, User $actor): void
    {
        DB::transaction(function () use ($code, $reason, $actor): void {
            [$quote, $version] = $this->load($code, $actor);

            if (! in_array($this->effectiveStatus($quote), [...self::LIVE, 'vencida'], true)) {
                throw ApiException::conflict('QTE-BR-17', 'Solo se rechaza una cotización enviada o vencida.');
            }

            DB::table('quote_versions')->where('id', $version->id)->update(['status' => 'rechazada']);
            $before = $this->states->transition($quote, QuoteStatus::Rechazada);
            $quote->forceFill(['rejected_at' => now(), 'rejected_reason' => $reason, 'updated_by' => $actor->getKey()])->save();
            $this->audit->log('Cotización', (string) $quote->code, 'rechazar', $before, $reason);
        });
    }

    public function delete(string $code, string $reason, User $actor): void
    {
        DB::transaction(function () use ($code, $reason, $actor): void {
            [$quote] = $this->load($code, $actor);

            if (in_array($quote->status, [QuoteStatus::Aprobada->value, QuoteStatus::Convertida->value], true) || $quote->reservation_id) {
                throw ApiException::conflict('QTE-BR-25', 'Una cotización aprobada o convertida en reserva no se elimina.');
            }

            $quote->forceFill(['updated_by' => $actor->getKey()])->save();
            $quote->delete();
            $this->audit->log('Cotización', (string) $quote->code, 'eliminar', (string) $quote->status, $reason);
        });
    }

    private function copyVersion(object $version, string $quoteId, int $number, User $actor): string
    {
        $copy = (array) DB::table('quote_versions')->where('id', $version->id)->first();
        $newId = (string) Str::uuid7();
        unset($copy['id'], $copy['internal_approval_id'], $copy['frozen_at'], $copy['content_hash'], $copy['pdf_document_id']);
        DB::table('quote_versions')->insert([...$copy, 'id' => $newId, 'quote_id' => $quoteId, 'version_no' => $number, 'status' => 'borrador', 'issued_on' => $this->today(), 'author_id' => $actor->getKey(), 'notes' => null, 'lock_version' => 0, 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey(), 'created_at' => now(), 'updated_at' => now()]);

        foreach (DB::table('quote_items')->where('quote_version_id', $version->id)->get() as $item) {
            $row = (array) $item;
            unset($row['id'], $row['cost_total'], $row['sale_total']);
            DB::table('quote_items')->insert([...$row, 'id' => (string) Str::uuid7(), 'quote_version_id' => $newId, 'created_at' => now(), 'updated_at' => now()]);
        }

        return $newId;
    }

    private function mail(Quote $quote, object $version, string $recipient, ?string $message): void
    {
        $agency = $this->context->tenant()->commercial_name;
        $total = Decimal::display((string) $version->grand_total, (string) $quote->currency);
        $valid = $quote->valid_until?->format('d/m/Y') ?? '';
        $body = trim(($message ? $message."\n\n" : '')."{$quote->title}\nTotal: {$total}\nVálida hasta: {$valid}\n\n{$agency}");

        app(QueuedMail::class)->send($recipient, null, "Cotización {$quote->code} · {$agency}", $body);
    }

    private function reasons(object $version): array
    {
        $limits = self::currentLimits();
        $reasons = [];

        if (self::discountNeedsApproval((string) $version->discount_pct, $limits['discount_limit'])) {
            $reasons[] = "Descuento de {$version->discount_pct} %";
        }

        if (self::marginNeedsApproval((string) $version->margin_pct, $limits['margin_floor'])) {
            $reasons[] = "Margen de {$version->margin_pct} %";
        }

        return $reasons;
    }

    private function overCap(object $version): bool
    {
        return BigDecimal::of((string) $version->discount_pct)->isGreaterThan(self::currentLimits()['max_discount']);
    }

    private function effectiveStatus(Quote $quote): string
    {
        return in_array($quote->status, self::LIVE, true) && ($quote->valid_until?->toDateString() ?? $this->today()) < $this->today() ? 'vencida' : (string) $quote->status;
    }

    private function load(string $code, User $actor, bool $lock = true): array
    {
        $query = Quote::query()->where(preg_match('/^[0-9a-f-]{36}$/i', $code) === 1 ? 'id' : 'code', $code);
        $quote = ($lock ? $query->lockForUpdate() : $query)->first() ?? throw ApiException::notFound('La cotización no existe.');
        Gate::forUser($actor)->authorize('view', $quote);
        $version = DB::table('quote_versions')->where('id', $quote->current_version_id)->first() ?? throw ApiException::conflict('QUOTE_EMPTY', 'La cotización no tiene una versión vigente.');

        return [$quote, $version];
    }

    private function renewedValidity(): string
    {
        return Carbon::parse($this->today())->addDays(QuoteBuilder::VALIDITY_DAYS)->toDateString();
    }

    private function today(): string
    {
        return Carbon::now($this->context->timezone())->toDateString();
    }
}
