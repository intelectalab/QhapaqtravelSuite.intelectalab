<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Support;

use App\Domain\Booking\Actions\ReservationWorkflow;
use App\Domain\Catalog\Support\CatalogAccess;
use App\Domain\Iam\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class ApprovalInbox
{
    public const TYPES = [
        'quote' => 'Cotización fuera de política',
        'change' => 'Cambio de reserva',
        'cancel' => 'Anulación de reserva',
        'reversal' => 'Reversión de pago',
        'payable' => 'Cuenta por pagar',
        'commission' => 'Comisión',
        'provider_rate' => 'Tarifa de proveedor',
        'credit_b2b' => 'Crédito B2B',
        'refund' => 'Reembolso',
        'other' => 'Otra excepción',
    ];

    public const GENERIC = ['credit_b2b', 'refund', 'other'];

    private const ORIGIN_PERMISSION = ['quote' => 'quotes.approve_internal', 'change' => 'quotes.approve_internal', 'cancel' => 'reservations.cancel', 'commission' => 'finance.commissions', 'payable' => 'finance.payables'];

    private const RATE_PERMISSIONS = ['catalog.products.manage_rates', 'catalog.providers.manage'];

    private const PORTAL_LABELS = ['commission' => 'Liquidación de comisiones', 'payable' => 'Factura de proveedor', 'provider_rate' => 'Tarifa de proveedor'];

    private array $names = [];

    private ?float $usd = null;

    public function __construct(private readonly ApprovalRules $rules) {}

    public function overview(User $viewer): array
    {
        $now = Carbon::now();
        $items = $this->quotes($viewer)
            ->concat($this->changes($viewer))
            ->concat($this->cancellations($viewer))
            ->concat($this->settlements($viewer))
            ->concat($this->rateRequests($viewer))
            ->concat($this->supplierInvoices($viewer))
            ->concat($this->requests($viewer))
            ->sortByDesc('created_at')
            ->values();

        $pending = $items->whereIn('status', ['pendiente', 'info']);
        $resolved = $items->filter(fn (array $item): bool => $item['decided_at'] !== null && Carbon::parse($item['decided_at'])->greaterThanOrEqualTo($now->copy()->subDays(7)));
        $hours = $resolved->map(fn (array $item): float => Carbon::parse($item['created_at'])->diffInMinutes(Carbon::parse($item['decided_at'])) / 60);

        return [
            'kpis' => [
                'for_me' => $pending->where('can_decide', true)->count(),
                'overdue' => $pending->where('sla', 'overdue')->count(),
                'sent_open' => $pending->where('mine', true)->count(),
                'resolved_week' => $resolved->count(),
                'avg_hours' => $hours->isEmpty() ? null : round($hours->avg(), 1),
            ],
            'items' => $items,
            'rules' => $this->rules->list(),
            'types' => collect(self::TYPES)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values(),
            'cancel_reasons' => ReservationWorkflow::CANCEL_REASONS,
            'can' => [
                'create' => $viewer->can('approvals.view'),
                'manage_rules' => $viewer->can('admin.settings.manage'),
            ],
        ];
    }

    private function quotes(User $viewer): Collection
    {
        $canDecide = $viewer->can(self::ORIGIN_PERMISSION['quote']);
        $sla = $this->rules->sla('quote', 1);

        return DB::table('quote_internal_approvals as a')
            ->join('quote_versions as v', 'v.id', '=', 'a.quote_version_id')
            ->join('quote_quotes as q', 'q.id', '=', 'v.quote_id')
            ->join('crm_clients as c', 'c.id', '=', 'q.client_id')
            ->whereNull('q.deleted_at')
            ->when(! $canDecide, fn ($query) => $query->where('a.requested_by', $viewer->getKey()))
            ->orderByDesc('a.created_at')
            ->limit(120)
            ->get(['a.id', 'a.status', 'a.reasons', 'a.over_cap', 'a.requested_by', 'a.requested_at', 'a.request_note', 'a.decided_by', 'a.decided_at', 'a.decision_note', 'a.created_at', 'q.code', 'q.lock_version', 'q.title', 'q.current_version_id', 'v.id as version_id', 'v.version_no', 'v.grand_total', 'v.currency', 'v.fx_rate', 'v.discount_pct', 'v.margin_pct', 'c.name as client'])
            ->map(function (object $row) use ($viewer, $canDecide, $sla): array {
                $created = $row->requested_at ?? $row->created_at;
                $reasons = json_decode((string) $row->reasons, true) ?: [];

                return $this->item([
                    'key' => "quote:{$row->id}",
                    'type' => 'quote',
                    'code' => "{$row->code} v{$row->version_no}",
                    'title' => $row->title,
                    'detail' => $row->request_note ?: implode(' · ', $reasons),
                    'facts' => [...$reasons, "Cliente: {$row->client}"],
                    'requester_id' => $row->requested_by,
                    'created_at' => $created,
                    'due_at' => Carbon::parse($created)->addHours($sla)->toIso8601String(),
                    'amount' => (float) $row->grand_total,
                    'currency' => $row->currency,
                    'fx_rate' => (float) $row->fx_rate,
                    'status' => $row->status,
                    'level' => 1,
                    'levels' => 1,
                    'decided_by' => $row->decided_by,
                    'decided_at' => $row->decided_at,
                    'decision_note' => $row->decision_note,
                    'href' => "/cotizaciones/{$row->code}",
                    'target' => $row->code,
                    'version_no' => (int) $row->version_no,
                    'lock_version' => (int) $row->lock_version,
                    'can_decide' => $canDecide && $row->requested_by !== $viewer->getKey() && $row->version_id === $row->current_version_id,
                ], $viewer);
            });
    }

    private function changes(User $viewer): Collection
    {
        $canDecide = $viewer->can(self::ORIGIN_PERMISSION['change']);

        return DB::table('booking_changes as b')
            ->join('booking_reservations as r', 'r.id', '=', 'b.reservation_id')
            ->join('crm_clients as c', 'c.id', '=', 'r.client_id')
            ->whereNull('r.deleted_at')
            ->when(! $canDecide, fn ($query) => $query->where('b.requested_by', $viewer->getKey()))
            ->orderByDesc('b.requested_at')
            ->limit(120)
            ->get(['b.id', 'b.type', 'b.description', 'b.delta_amount', 'b.status', 'b.requested_by', 'b.requested_at', 'b.decided_by', 'b.decided_at', 'r.code', 'r.lock_version', 'r.title', 'r.currency', 'r.fx_rate', 'c.name as client'])
            ->map(fn (object $row): array => $this->item([
                'key' => "change:{$row->id}",
                'type' => 'change',
                'code' => $row->code,
                'title' => $row->title,
                'detail' => $row->description,
                'facts' => ['Tipo de cambio: '.str_replace('_', ' ', $row->type), "Cliente: {$row->client}"],
                'requester_id' => $row->requested_by,
                'created_at' => $row->requested_at,
                'due_at' => Carbon::parse($row->requested_at)->addHours(24)->toIso8601String(),
                'amount' => (float) $row->delta_amount,
                'currency' => $row->currency,
                'fx_rate' => (float) $row->fx_rate,
                'status' => $row->status === 'aplicada' ? 'aprobada' : $row->status,
                'level' => 1,
                'levels' => 1,
                'decided_by' => $row->decided_by,
                'decided_at' => $row->decided_at,
                'decision_note' => null,
                'href' => "/reservas/{$row->code}",
                'target' => $row->code,
                'change_id' => $row->id,
                'lock_version' => (int) $row->lock_version,
                'can_decide' => $canDecide && $row->requested_by !== $viewer->getKey(),
            ], $viewer));
    }

    private function cancellations(User $viewer): Collection
    {
        $canDecide = $viewer->can(self::ORIGIN_PERMISSION['cancel']);
        $sla = $this->rules->sla('cancel', 1);

        return DB::table('booking_cancel_requests as b')
            ->join('booking_reservations as r', 'r.id', '=', 'b.reservation_id')
            ->join('crm_clients as c', 'c.id', '=', 'r.client_id')
            ->leftJoin('channel_b2b_agencies as g', 'g.id', '=', 'r.agency_id')
            ->whereNull('r.deleted_at')
            ->when(! $canDecide, fn ($query) => $query->where('b.requested_by', $viewer->getKey()))
            ->orderByDesc('b.requested_at')
            ->limit(120)
            ->get(['b.id', 'b.reason', 'b.status', 'b.requested_by', 'b.requested_at', 'b.decided_by', 'b.decided_at', 'b.decision_note', 'r.code', 'r.lock_version', 'r.title', 'r.status as reservation_status', 'r.total_amount', 'r.currency', 'r.fx_rate', 'r.b2b_terms', 'c.name as client', 'g.code as agency_code', 'g.legal_name as agency'])
            ->map(function (object $row) use ($viewer, $canDecide, $sla): array {
                [$reason, $detail] = $this->splitReason((string) $row->reason);
                $terms = json_decode((string) $row->b2b_terms, true) ?: [];
                $agency = $row->agency_code ? ["Agencia: {$row->agency} ({$row->agency_code})", 'Forma de pago: '.(($terms['pay_mode'] ?? null) === 'credito' ? 'crédito B2B, se libera al anular' : 'prepago')] : [];

                return $this->item([
                    'key' => "cancel:{$row->id}",
                    'type' => 'cancel',
                    'code' => $row->code,
                    'title' => $row->title,
                    'detail' => $detail,
                    'facts' => ["Motivo: {$reason}", ...$agency, "Cliente: {$row->client}"],
                    'requester_suffix' => $row->agency_code ? 'Portal B2B' : null,
                    'requester_id' => $row->requested_by,
                    'created_at' => $row->requested_at,
                    'due_at' => Carbon::parse($row->requested_at)->addHours($sla)->toIso8601String(),
                    'amount' => (float) $row->total_amount,
                    'currency' => $row->currency,
                    'fx_rate' => (float) $row->fx_rate,
                    'status' => $row->status === 'retirada' ? 'anulada' : $row->status,
                    'level' => 1,
                    'levels' => 1,
                    'decided_by' => $row->decided_by,
                    'decided_at' => $row->decided_at,
                    'decision_note' => $row->decision_note,
                    'href' => "/reservas/{$row->code}",
                    'target' => $row->code,
                    'cancel_reason' => $reason,
                    'cancel_id' => $row->id,
                    'lock_version' => (int) $row->lock_version,
                    'can_decide' => $canDecide && $row->requested_by !== $viewer->getKey() && ! in_array($row->reservation_status, ['cancelada', 'completada'], true),
                ], $viewer);
            });
    }

    private function settlements(User $viewer): Collection
    {
        if (! $viewer->can(self::ORIGIN_PERMISSION['commission'])) {
            return collect();
        }

        $sla = $this->rules->sla('commission', 1);

        return DB::table('channel_b2b_settlement_requests as s')
            ->join('channel_b2b_agencies as g', 'g.id', '=', 's.agency_id')
            ->orderByDesc('s.created_at')
            ->limit(120)
            ->get(['s.id', 's.code', 's.amount_pen', 's.fx_rate', 's.commission_ids', 's.status', 's.requested_by', 's.created_at', 's.updated_by', 's.updated_at', 'g.code as agency_code', 'g.legal_name as agency'])
            ->map(function (object $row) use ($viewer, $sla): array {
                $ids = array_values(array_filter(explode(',', trim((string) $row->commission_ids, '{}'))));
                $commissions = DB::table('fin_commissions as f')->leftJoin('booking_reservations as r', 'r.id', '=', 'f.reservation_id')->whereIn('f.id', $ids)->whereNull('f.deleted_at')->get(['f.code', 'f.status', 'f.observation', 'r.code as reservation']);
                $open = $row->status === 'solicitada';

                return $this->item([
                    'key' => "settlement:{$row->id}",
                    'source' => 'settlement',
                    'type' => 'commission',
                    'type_label' => self::PORTAL_LABELS['commission'],
                    'code' => $row->code,
                    'title' => "Liquidación de comisiones de {$row->agency}",
                    'detail' => $open ? 'Al aprobar, las comisiones calculadas pasan a aprobadas y quedan listas para pagar en Finanzas › Comisiones. Al rechazar, vuelven a quedar disponibles para una nueva solicitud.' : null,
                    'facts' => [
                        "Agencia: {$row->agency} ({$row->agency_code})",
                        'Comisiones: '.$commissions->count().' ('.$commissions->groupBy('status')->map(fn (Collection $group, string $status): string => "{$status} × ".$group->count())->implode(', ').')',
                        'Reservas: '.($commissions->pluck('reservation')->filter()->unique()->implode(', ') ?: '—'),
                    ],
                    'requester_id' => $row->requested_by,
                    'requester_suffix' => 'Portal B2B',
                    'created_at' => $row->created_at,
                    'due_at' => Carbon::parse($row->created_at)->addHours($sla)->toIso8601String(),
                    'amount' => (float) $row->amount_pen,
                    'currency' => 'PEN',
                    'fx_rate' => 1.0,
                    'status' => $open ? 'pendiente' : $row->status,
                    'level' => 1,
                    'levels' => 1,
                    'decided_by' => $open ? null : $row->updated_by,
                    'decided_at' => $open ? null : $row->updated_at,
                    'decision_note' => $row->status === 'rechazada' ? $commissions->pluck('observation')->filter()->first() : null,
                    'href' => '/finanzas/comisiones',
                    'target' => $row->code,
                    'approve_label' => 'Aprobar comisiones',
                    'lock_version' => 0,
                    'can_decide' => $open && $commissions->isNotEmpty(),
                ], $viewer);
            });
    }

    private function rateRequests(User $viewer): Collection
    {
        if (! collect(self::RATE_PERMISSIONS)->contains(fn (string $permission): bool => $viewer->can($permission))) {
            return collect();
        }

        $sla = $this->rules->sla('provider_rate', 1);
        $today = CatalogAccess::today();

        return DB::table('supplier_rate_requests as q')
            ->join('catalog_services as s', 's.id', '=', 'q.service_id')
            ->join('catalog_providers as p', 'p.id', '=', 'q.provider_id')
            ->orderByDesc('q.requested_at')
            ->limit(120)
            ->get(['q.id', 'q.code', 'q.current_cost', 'q.proposed_cost', 'q.currency', 'q.effective_from', 'q.reason_type', 'q.reason_detail', 'q.status', 'q.requested_by', 'q.requested_at', 'q.reviewed_by', 'q.reviewed_at', 'q.review_note', 's.ref as service_ref', 's.name as service', 's.unit', 's.cost as service_cost', 'p.name as provider'])
            ->map(function (object $row) use ($viewer, $sla, $today): array {
                $current = (float) $row->current_cost;
                $proposed = (float) $row->proposed_cost;
                $change = $current > 0 ? round(($proposed - $current) / $current * 100, 1) : null;
                $open = $row->status === 'pendiente';

                return $this->item([
                    'key' => "rate:{$row->id}",
                    'source' => 'rate',
                    'type' => 'provider_rate',
                    'type_label' => self::PORTAL_LABELS['provider_rate'],
                    'code' => $row->code,
                    'title' => "{$row->service} · {$row->provider}",
                    'detail' => $row->reason_detail,
                    'facts' => [...array_filter([
                        "Servicio: {$row->service_ref} · por {$row->unit}",
                        "Tarifa actual: {$row->currency} ".number_format($current, 2),
                        "Tarifa propuesta: {$row->currency} ".number_format($proposed, 2).($change !== null ? ' ('.($change > 0 ? '+' : '')."{$change} %)" : ''),
                        "Rige desde: {$row->effective_from}".($open ? ($row->effective_from <= $today ? ' · se aplica de inmediato' : ' · queda programada') : ''),
                        "Motivo: {$row->reason_type}",
                        $open && round((float) $row->service_cost, 2) !== round($current, 2) ? "Aviso: el costo del servicio cambió a {$row->currency} {$row->service_cost} después de la solicitud" : null,
                    ])],
                    'requester_id' => $row->requested_by,
                    'requester_suffix' => 'Extranet',
                    'created_at' => $row->requested_at,
                    'due_at' => Carbon::parse($row->requested_at)->addHours($sla)->toIso8601String(),
                    'amount' => $proposed,
                    'currency' => $row->currency,
                    'fx_rate' => $row->currency === 'PEN' ? 1.0 : $this->usdRate(),
                    'status' => $row->status === 'retirada' ? 'anulada' : ($open ? 'pendiente' : $row->status),
                    'level' => 1,
                    'levels' => 1,
                    'decided_by' => $row->reviewed_by,
                    'decided_at' => $row->reviewed_at,
                    'decision_note' => $row->review_note,
                    'href' => '/catalogo/servicios',
                    'target' => $row->code,
                    'approve_label' => 'Aprobar tarifa',
                    'lock_version' => 0,
                    'can_decide' => $open,
                ], $viewer);
            });
    }

    private function supplierInvoices(User $viewer): Collection
    {
        if (! $viewer->can(self::ORIGIN_PERMISSION['payable'])) {
            return collect();
        }

        $sla = $this->rules->sla('payable', 1);

        return DB::table('supplier_invoices as i')
            ->join('fin_payables as f', 'f.id', '=', 'i.payable_id')
            ->join('catalog_providers as p', 'p.id', '=', 'i.provider_id')
            ->leftJoin('booking_reservations as r', 'r.id', '=', 'f.reservation_id')
            ->whereNull('i.deleted_at')
            ->whereNull('f.deleted_at')
            ->orderByDesc('i.uploaded_at')
            ->limit(120)
            ->get(['i.id', 'i.number', 'i.issue_date', 'i.amount', 'i.currency', 'i.amount_difference', 'i.original_file_name', 'i.status', 'i.uploaded_by', 'i.uploaded_at', 'i.validated_by', 'i.validated_at', 'i.validation_note', 'f.code as payable', 'f.concept', 'f.amount as payable_amount', 'f.paid_amount', 'f.status as payable_status', 'f.approved_at', 'f.fx_rate', 'p.name as provider', 'r.code as reservation'])
            ->map(function (object $row) use ($viewer, $sla): array {
                $balance = round((float) $row->payable_amount - (float) $row->paid_amount, 2);
                $difference = (float) $row->amount_difference;
                $open = $row->status === 'registrada';

                return $this->item([
                    'key' => "invoice:{$row->id}",
                    'source' => 'invoice',
                    'type' => 'payable',
                    'type_label' => self::PORTAL_LABELS['payable'],
                    'code' => $row->number,
                    'title' => "{$row->provider} · {$row->concept}",
                    'detail' => null,
                    'facts' => [...array_filter([
                        "Cuenta por pagar: {$row->payable}".($row->approved_at ? ' · aprobada' : ' · por aprobar'),
                        "Saldo de la cuenta: {$row->currency} ".number_format($balance, 2),
                        abs($difference) > 0.01 ? "Diferencia: {$row->currency} ".number_format($difference, 2).' · explica el motivo si la validas' : 'Importe: coincide con el saldo',
                        "Emitida: {$row->issue_date}",
                        "Archivo: {$row->original_file_name}",
                        $row->reservation ? "Reserva: {$row->reservation}" : null,
                    ])],
                    'requester_id' => $row->uploaded_by,
                    'requester_suffix' => 'Extranet',
                    'created_at' => $row->uploaded_at,
                    'due_at' => Carbon::parse($row->uploaded_at)->addHours($sla)->toIso8601String(),
                    'amount' => (float) $row->amount,
                    'currency' => $row->currency,
                    'fx_rate' => $row->currency === 'PEN' ? 1.0 : ((float) $row->fx_rate ?: $this->usdRate()),
                    'status' => $open ? 'pendiente' : $row->status,
                    'level' => 1,
                    'levels' => 1,
                    'decided_by' => $row->validated_by,
                    'decided_at' => $row->validated_at,
                    'decision_note' => $row->validation_note,
                    'href' => '/finanzas/proveedores',
                    'target' => $row->payable,
                    'approve_label' => 'Validar factura',
                    'reject_label' => 'Observar',
                    'can_decide' => $open && $row->payable_status !== 'cancelada',
                ], $viewer);
            });
    }

    private function usdRate(): float
    {
        return $this->usd ??= (float) (DB::table('fin_fx_rates')->where('currency_code', 'USD')->orderByDesc('rate_date')->orderByDesc('effective_at')->value('rate_pen') ?? 1);
    }

    private function requests(User $viewer): Collection
    {
        $rows = DB::table('collab_approval_requests')
            ->where(fn ($query) => $query->whereNull('subject_type')->orWhereNotIn('subject_type', OriginClosure::MIRRORED))
            ->orderByDesc('created_at')->limit(200)->get();
        $steps = DB::table('collab_approval_steps')->whereIn('request_id', $rows->pluck('id'))->orderBy('level')->get()->groupBy('request_id');
        $events = DB::table('collab_approval_events')->whereIn('request_id', $rows->pluck('id'))->orderBy('occurred_at')->get()->groupBy('request_id');

        return $rows->map(function (object $row) use ($viewer, $steps, $events): ?array {
            $permissions = $this->rules->permissions($row->request_type);
            $levelPermission = $this->rules->permission($row->request_type, (int) $row->current_level);
            $mine = $row->requester_id === $viewer->getKey();

            if (! $mine && ! collect($permissions)->contains(fn (string $permission): bool => $viewer->can($permission))) {
                return null;
            }

            $own = $steps->get($row->id, collect());
            $open = in_array($row->status, ['pendiente', 'info'], true);
            $item = $this->item([
                'key' => "request:{$row->code}",
                'type' => $row->request_type,
                'code' => $row->code,
                'title' => $row->title,
                'detail' => $row->justification,
                'facts' => array_values(array_filter([$row->subject_code ? "Origen: {$row->subject_code}" : null, $row->is_generic ? 'Solicitud creada en la bandeja' : null])),
                'requester_id' => $row->requester_id,
                'requester_kind' => $row->requester_kind,
                'created_at' => $row->created_at,
                'due_at' => $row->due_at,
                'amount' => (float) $row->amount,
                'currency' => $row->currency,
                'fx_rate' => (float) $row->fx_rate,
                'status' => $row->status,
                'level' => (int) $row->current_level,
                'levels' => (int) $row->total_levels,
                'decided_by' => $row->decided_by,
                'decided_at' => $row->decided_at,
                'decision_note' => $row->decision_note,
                'href' => null,
                'target' => $row->code,
                'lock_version' => (int) $row->lock_version,
                'is_generic' => (bool) $row->is_generic,
                'permission' => $levelPermission,
                'can_decide' => $open && $levelPermission !== null && $viewer->can($levelPermission) && ! $mine && ! $own->contains('decided_by', $viewer->getKey()),
                'can_edit' => $open && $mine && (bool) $row->is_generic,
            ], $viewer);

            $item['steps'] = $own->map(fn ($step): array => ['level' => (int) $step->level, 'decision' => $step->decision, 'by' => $this->name($step->decided_by), 'at' => $step->decided_at, 'note' => $step->note])->values();
            $item['events'] = $events->get($row->id, collect())->map(fn ($event): array => ['event' => $event->event, 'by' => $this->name($event->actor_id), 'at' => $event->occurred_at, 'note' => $event->note])->values();

            return $item;
        })->filter()->values();
    }

    private function item(array $item, User $viewer): array
    {
        $open = in_array($item['status'], ['pendiente', 'info'], true);
        $due = $item['due_at'] ? Carbon::parse($item['due_at']) : null;
        $now = Carbon::now();
        $sla = match (true) {
            ! $open || $due === null => 'done',
            $item['status'] === 'info' => 'paused',
            $due->isPast() => 'overdue',
            $now->diffInMinutes($due) <= 240 => 'warning',
            default => 'ok',
        };

        $requester = $item['requester_id'] ? $this->name($item['requester_id']) : (($item['requester_kind'] ?? 'user') === 'system' ? 'Sistema' : 'Proveedor');

        return [
            ...$item,
            'type_label' => $item['type_label'] ?? self::TYPES[$item['type']] ?? $item['type'],
            'requester' => isset($item['requester_suffix']) ? "{$requester} · {$item['requester_suffix']}" : $requester,
            'decider' => $item['decided_by'] ? $this->name($item['decided_by']) : null,
            'amount_pen' => round($item['amount'] * ($item['currency'] === 'PEN' ? 1 : ($item['fx_rate'] ?: 1)), 2),
            'sla' => $sla,
            'mine' => $item['requester_id'] === $viewer->getKey(),
            'steps' => [],
            'events' => [],
            'can_edit' => $item['can_edit'] ?? false,
            'lock_version' => $item['lock_version'] ?? null,
        ];
    }

    private function splitReason(string $reason): array
    {
        $reason = (string) preg_replace('/^Agencia [A-Z0-9-]+ · /u', '', $reason);

        foreach (ReservationWorkflow::CANCEL_REASONS as $known) {
            if (str_starts_with($reason, "{$known}: ")) {
                return [$known, mb_substr($reason, mb_strlen($known) + 2)];
            }
        }

        return ['Otro', $reason];
    }

    private function name(?string $id): string
    {
        if ($id === null) {
            return 'Sistema';
        }

        if ($this->names === []) {
            $this->names = DB::table('iam_users')->pluck('name', 'id')->all();
        }

        return $this->names[$id] ?? 'Usuario';
    }
}
