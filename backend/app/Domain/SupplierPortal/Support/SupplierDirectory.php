<?php

declare(strict_types=1);

namespace App\Domain\SupplierPortal\Support;

use App\Domain\Booking\Actions\ProviderServiceResponse;
use App\Domain\Finance\Support\PayableDirectory;
use App\Domain\Finance\Support\ReceivableLedger;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\SupplierPortal\Actions\ProposeAlternative;
use App\Domain\SupplierPortal\Actions\SupplierInvoices;
use App\Domain\SupplierPortal\Actions\SupplierRateRequests;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class SupplierDirectory
{
    public const RESPONSE_HOURS = 24;

    public const CONTRACT_WARNING_DAYS = 60;

    private const SCHEDULED = ['confirmado', 'en_curso', 'completado'];

    private const SERVICE_COLUMNS = ['s.id', 's.code', 's.lock_version', 's.name', 's.service_kind', 's.service_date', 's.service_time', 's.pax', 's.rooms', 's.nights', 's.status', 's.confirmation_code', 's.confirmed_by_name', 's.confirmed_at', 's.cost_amount', 's.currency', 's.requested_at', 's.reject_reason', 's.alt_of_id', 's.replaced_by_id', 's.reservation_id', 's.product_id', 's.departure_id', 'r.code as reservation_code', 'r.title as reservation_title'];

    public function __construct(private readonly TenantContext $context, private readonly SupplierOperations $operations) {}

    public function session(SupplierAccount $account): array
    {
        $tenant = $this->context->tenant();

        return [
            'provider' => ['ref' => $account->provider->ref, 'name' => $account->provider->name, 'type' => $account->provider->type, 'city' => $account->provider->city, 'initials' => $this->initials($account->provider->name)],
            'agency' => ['name' => $tenant->commercial_name, 'initials' => $tenant->logo_initials],
            'user' => ['name' => $account->user->name, 'email' => $account->user->email],
            'counts' => ['pending' => (clone $account->services())->whereIn('s.status', ProviderServiceResponse::OPEN)->count(), 'rooming' => $this->operations->pendingRooming($account), 'incidents' => $this->operations->openIncidents($account)],
        ];
    }

    public function home(SupplierAccount $account): array
    {
        $today = $this->today();
        $week = Carbon::parse($today)->addDays(7)->toDateString();
        $requests = $this->rows($account);
        $pending = $requests->where('state', 'por_responder')->sortBy(fn (array $row): string => ($row['deadline'] ?? '9999').$row['date'])->values();
        $upcoming = $requests->whereIn('status', self::SCHEDULED)->filter(fn (array $row): bool => $row['date'] >= $today && $row['date'] <= $week)->sortBy(fn (array $row): string => $row['date'].($row['time'] ?? ''))->values();
        $payables = $this->payableRows($account);
        $open = $payables->where('balance', '>', ReceivableLedger::TOLERANCE);
        $contract = $this->contract($account);

        return [
            'today' => $today,
            'kpis' => [
                'pending' => $pending->count(),
                'alternatives' => $requests->where('state', 'alternativa_propuesta')->count(),
                'overdue' => $pending->where('overdue', true)->count(),
                'upcoming' => $upcoming->count(),
                'upcoming_pax' => (int) $upcoming->sum('pax'),
                'receivable' => $this->byCurrency($open, 'balance'),
                'contract_days' => $contract['days_left'],
                'open_incidents' => $this->operations->openIncidents($account),
            ],
            'pending' => $pending->take(6)->values(),
            'upcoming' => $upcoming->take(8)->values(),
            'payments' => $open->sortBy(fn (array $row): string => $row['scheduled_date'] ?? $row['due_date'])->take(5)->values(),
            'alerts' => $this->alerts($account, $pending, $open, $contract),
        ];
    }

    public function requests(SupplierAccount $account): array
    {
        return [
            'today' => $this->today(),
            'response_hours' => self::RESPONSE_HOURS,
            'rows' => $this->rows($account)->sortBy(fn (array $row): string => (in_array($row['state'], ['por_responder', 'alternativa_propuesta'], true) ? '0' : '1').$row['date'])->values(),
            'reasons' => ProviderServiceResponse::REJECT_REASONS,
            'alternative_kinds' => ProposeAlternative::KINDS,
            'catalog' => $this->catalogOptions($account),
        ];
    }

    public function request(SupplierAccount $account, string $code): array
    {
        $service = $account->service($code);
        $row = $this->rows($account, $service->id)->first();
        $voucher = DB::table('ops_vouchers')->where('reservation_service_id', $service->id)->where('provider_id', $account->id())->orderByDesc('version')->first(['code', 'version', 'status', 'issued_at', 'used_at']);
        $related = DB::table('booking_reservation_services')->where('provider_id', $account->id())->whereIn('id', array_filter([$service->alt_of_id, $service->replaced_by_id]))->get(['id', 'code', 'service_date', 'status'])->keyBy('id');

        return [
            ...$row,
            'reasons' => ProviderServiceResponse::REJECT_REASONS,
            'alternative_kinds' => ProposeAlternative::KINDS,
            'catalog' => $this->catalogOptions($account),
            'today' => $this->today(),
            'contact' => $account->provider->contact_name,
            'passengers' => DB::table('booking_passengers')->where('reservation_id', $service->reservation_id)->orderBy('seq')->get(['full_name', 'pax_type', 'nationality', 'diet_notes', 'is_lead', 'is_placeholder'])
                ->map(fn (object $pax): array => ['name' => $pax->full_name, 'type' => $pax->pax_type, 'nationality' => $pax->nationality, 'diet' => $pax->diet_notes, 'lead' => (bool) $pax->is_lead, 'placeholder' => (bool) $pax->is_placeholder])->values(),
            'pickup' => $service->service_kind === 'alojamiento' ? null : $this->pickup($service),
            'reject_reason' => $service->reject_reason,
            'voucher' => $voucher ? ['code' => $voucher->code, 'version' => (int) $voucher->version, 'status' => $voucher->status, 'issued_at' => $this->iso($voucher->issued_at), 'used_at' => $this->iso($voucher->used_at)] : null,
            'alternative_service' => isset($related[$service->alt_of_id]) ? $this->relatedService($related[$service->alt_of_id]) : null,
            'replaced_by' => isset($related[$service->replaced_by_id]) ? $this->relatedService($related[$service->replaced_by_id]) : null,
            'rooming' => $service->service_kind === 'alojamiento' ? $this->rooming($account, $service->reservation_id) : null,
            'history' => $this->history($account, $service->id),
        ];
    }

    public function calendar(SupplierAccount $account, ?string $month): array
    {
        $today = $this->today();
        $start = $month !== null && preg_match('/^\d{4}-\d{2}$/', $month) === 1 ? Carbon::parse("{$month}-01") : Carbon::parse($today)->startOfMonth();
        $rows = $this->rows($account)->whereIn('status', self::SCHEDULED);
        $months = $rows->groupBy(fn (array $row): string => substr($row['date'], 0, 7))->map(fn (Collection $group, string $key): array => ['month' => $key, 'count' => $group->count()])->sortKeys()->values();

        return [
            'today' => $today,
            'month' => $start->format('Y-m'),
            'months' => $months,
            'rows' => $rows->filter(fn (array $row): bool => substr($row['date'], 0, 7) === $start->format('Y-m'))->sortBy(fn (array $row): string => $row['date'].($row['time'] ?? ''))->values(),
        ];
    }

    public function rates(SupplierAccount $account, SupplierRateRequests $requests): array
    {
        $services = DB::table('catalog_services')->where('provider_id', $account->id())->whereNull('deleted_at')->orderBy('ref')->get();
        $ids = $services->pluck('id')->all();
        $history = DB::table('catalog_service_cost_history')->whereIn('service_id', $ids)->orderByDesc('effective_from')->get(['service_id', 'cost', 'currency', 'effective_from', 'effective_to', 'source'])->groupBy('service_id');
        $usage = DB::table('booking_reservation_services')->whereIn('catalog_service_id', $ids)->whereNotIn('status', ['cancelado', 'rechazado'])->selectRaw('catalog_service_id, count(*) as total')->groupBy('catalog_service_id')->pluck('total', 'catalog_service_id');
        $rows = DB::table('supplier_rate_requests as q')->join('catalog_services as c', 'c.id', '=', 'q.service_id')->where('q.provider_id', $account->id())->orderByDesc('q.requested_at')
            ->get(['q.code', 'q.current_cost', 'q.proposed_cost', 'q.currency', 'q.effective_from', 'q.reason_type', 'q.reason_detail', 'q.status', 'q.requested_at', 'q.reviewed_at', 'q.review_note', 'c.ref as service_ref', 'c.name as service_name', 'c.unit as service_unit']);
        $pending = $rows->where('status', 'pendiente')->keyBy('service_ref');

        return [
            'today' => $this->today(),
            'earliest' => $requests->earliest(),
            'notice_days' => SupplierRateRequests::NOTICE_DAYS,
            'reasons' => SupplierRateRequests::REASONS,
            'currency' => $account->provider->currency,
            'services' => $services->map(fn (object $service): array => [
                'ref' => $service->ref,
                'name' => $service->name,
                'type' => $service->type,
                'unit' => $service->unit,
                'cost' => (float) $service->cost,
                'currency' => $service->currency,
                'capacity' => $service->capacity === null ? null : (int) $service->capacity,
                'valid_from' => $service->valid_from,
                'valid_to' => $service->valid_to,
                'status' => $service->status,
                'scheduled_cost' => $service->scheduled_cost === null ? null : (float) $service->scheduled_cost,
                'scheduled_from' => $service->scheduled_cost_from,
                'bookings' => (int) ($usage[$service->id] ?? 0),
                'pending' => isset($pending[$service->ref]) ? ['code' => $pending[$service->ref]->code, 'proposed' => (float) $pending[$service->ref]->proposed_cost, 'from' => $pending[$service->ref]->effective_from] : null,
                'history' => collect($history[$service->id] ?? [])->map(fn ($item): array => ['cost' => (float) $item->cost, 'currency' => $item->currency, 'from' => $item->effective_from, 'to' => $item->effective_to, 'source' => $item->source])->values(),
            ])->values(),
            'requests' => $rows->map(fn (object $row): array => [
                'code' => $row->code,
                'service_ref' => $row->service_ref,
                'service' => $row->service_name,
                'unit' => $row->service_unit,
                'current' => (float) $row->current_cost,
                'proposed' => (float) $row->proposed_cost,
                'change_pct' => (float) $row->current_cost > 0 ? round(((float) $row->proposed_cost - (float) $row->current_cost) / (float) $row->current_cost * 100, 1) : null,
                'currency' => $row->currency,
                'effective_from' => $row->effective_from,
                'reason_type' => $row->reason_type,
                'reason_detail' => $row->reason_detail,
                'status' => $row->status,
                'requested_at' => $this->iso($row->requested_at),
                'reviewed_at' => $this->iso($row->reviewed_at),
                'review_note' => $row->review_note,
            ])->values(),
        ];
    }

    public function payables(SupplierAccount $account): array
    {
        $rows = $this->payableRows($account);
        $open = $rows->where('balance', '>', ReceivableLedger::TOLERANCE);

        return [
            'today' => $this->today(),
            'payment_terms' => $account->provider->payment_terms,
            'max_kb' => intdiv(SupplierInvoices::MAX_BYTES, 1024),
            'rows' => $rows->values(),
            'totals' => [
                'balance' => $this->byCurrency($open, 'balance'),
                'paid' => $this->byCurrency($rows, 'paid'),
                'overdue' => $open->where('status', 'vencida')->count(),
                'without_invoice' => $rows->where('can_invoice', true)->count(),
            ],
        ];
    }

    public function company(SupplierAccount $account): array
    {
        $tenant = $this->context->tenant();
        $provider = $account->provider;

        return [
            'provider' => [
                'ref' => $provider->ref,
                'name' => $provider->name,
                'type' => $provider->type,
                'ruc' => $provider->ruc,
                'city' => $provider->city,
                'stars' => $provider->stars === null ? null : (int) $provider->stars,
                'contact' => $provider->contact_name,
                'phone' => $provider->phone,
                'email' => $provider->email,
                'currency' => $provider->currency,
                'payment_terms' => $provider->payment_terms,
                'status' => $provider->status,
            ],
            'contract' => $this->contract($account),
            'agency' => ['name' => $tenant->commercial_name, 'legal_name' => $tenant->legal_name, 'ruc' => $tenant->ruc, 'address' => $tenant->fiscal_address],
            'contacts' => DB::table('catalog_provider_contacts')->where('provider_id', $account->id())->orderBy('created_at')->get(['id', 'name', 'role', 'phone', 'email'])->values(),
            'users' => DB::table('iam_users')->where('provider_id', $account->id())->whereNull('deleted_at')->orderBy('name')->get(['name', 'email', 'status', 'last_login_at'])->map(fn (object $user): array => ['name' => $user->name, 'email' => $user->email, 'status' => $user->status, 'last_login_at' => $this->iso($user->last_login_at)])->values(),
            'activity' => [
                'services' => (clone $account->services())->whereNotIn('s.status', ['cancelado'])->count(),
                'reservations' => (clone $account->services())->distinct()->count('s.reservation_id'),
                'catalog' => DB::table('catalog_services')->where('provider_id', $account->id())->whereNull('deleted_at')->where('status', 'activo')->count(),
            ],
        ];
    }

    private function rows(SupplierAccount $account, ?string $serviceId = null): Collection
    {
        $services = (clone $account->services())->when($serviceId, fn ($query) => $query->where('s.id', $serviceId))
            ->orderBy('s.service_date')->orderByRaw('s.service_time nulls last')->orderBy('s.code')
            ->get(self::SERVICE_COLUMNS);
        $reservationIds = $services->pluck('reservation_id')->unique()->all();
        $leads = DB::table('booking_passengers')->whereIn('reservation_id', $reservationIds)->orderByDesc('is_lead')->orderBy('seq')->get(['reservation_id', 'full_name'])->unique('reservation_id')->pluck('full_name', 'reservation_id');
        $alternatives = DB::table('booking_reservation_services')->whereIn('id', $services->pluck('alt_of_id')->filter()->all())->pluck('code', 'id');
        $proposals = DB::table('supplier_request_responses as x')->leftJoin('catalog_services as c', 'c.id', '=', 'x.alt_service_id')
            ->whereIn('x.reservation_service_id', $services->pluck('id')->all())->where('x.provider_id', $account->id())->where('x.type', 'alternativa')
            ->orderByDesc('x.responded_at')->get(['x.reservation_service_id', 'x.alt_kind', 'x.alt_date', 'x.alt_net_cost', 'x.currency', 'x.hold_until', 'x.note', 'x.review_status', 'x.review_note', 'x.responded_at', 'c.ref as service_ref', 'c.name as service_name'])
            ->unique('reservation_service_id')->keyBy('reservation_service_id');
        $now = Carbon::now($this->context->timezone());
        $today = $now->toDateString();

        return $services->map(function (object $row) use ($leads, $alternatives, $proposals, $now, $today): array {
            $open = in_array($row->status, ProviderServiceResponse::OPEN, true);
            $proposal = $proposals[$row->id] ?? null;
            $deadline = $open && $row->requested_at ? Carbon::parse($row->requested_at)->addHours(self::RESPONSE_HOURS) : null;
            $pax = (int) ($row->pax ?? 0);

            return [
                'code' => $row->code,
                'lock_version' => (int) $row->lock_version,
                'reservation' => $row->reservation_code,
                'holder' => $pax >= 6 ? 'Grupo: '.Str::before((string) $row->reservation_title, ' — ') : 'Titular: '.($leads[$row->reservation_id] ?? 'por confirmar'),
                'service' => $row->name,
                'kind' => $row->service_kind,
                'date' => $row->service_date,
                'time' => $row->service_time ? substr((string) $row->service_time, 0, 5) : null,
                'pax' => $pax,
                'rooms' => $row->rooms === null ? null : (int) $row->rooms,
                'nights' => $row->nights === null ? null : (int) $row->nights,
                'net_cost' => (float) $row->cost_amount,
                'currency' => $row->currency,
                'status' => $row->status,
                'state' => $open ? ($proposal?->review_status === 'pendiente' ? 'alternativa_propuesta' : 'por_responder') : $row->status,
                'proposal' => $proposal ? [
                    'kind' => $proposal->alt_kind,
                    'date' => $proposal->alt_date,
                    'service' => $proposal->service_ref ? ['ref' => $proposal->service_ref, 'name' => $proposal->service_name] : null,
                    'net_cost' => $proposal->alt_net_cost === null ? null : (float) $proposal->alt_net_cost,
                    'currency' => $proposal->currency,
                    'hold_until' => $proposal->hold_until,
                    'note' => $proposal->note,
                    'review_status' => $proposal->review_status,
                    'review_note' => $proposal->review_note,
                    'at' => $this->iso($proposal->responded_at),
                ] : null,
                'confirmation_code' => $row->confirmation_code,
                'confirmed_by' => $row->confirmed_by_name,
                'confirmed_at' => $this->iso($row->confirmed_at),
                'requested_at' => $this->iso($row->requested_at),
                'deadline' => $deadline?->toIso8601String(),
                'overdue' => $deadline !== null && $deadline->lessThan($now),
                'days_to' => (int) Carbon::parse($today)->diffInDays(Carbon::parse($row->service_date), false),
                'alternative_of' => $row->alt_of_id ? ($alternatives[$row->alt_of_id] ?? null) : null,
            ];
        });
    }

    private function payableRows(SupplierAccount $account): Collection
    {
        $today = $this->today();
        $rows = (clone $account->payables())->orderBy('p.due_date')
            ->get(['p.id', 'p.code', 'p.concept', 'p.amount', 'p.paid_amount', 'p.currency', 'p.due_date', 'p.status', 'p.approved_at', 'p.scheduled_date', 'p.supplier_doc_number', 'r.code as reservation_code', 's.name as service_name']);
        $ids = $rows->pluck('id')->all();
        $invoices = DB::table('supplier_invoices')->whereIn('payable_id', $ids)->whereNull('deleted_at')->orderByRaw("case when status in ('registrada', 'validada') then 0 else 1 end")->orderByDesc('uploaded_at')->get(['payable_id', 'number', 'issue_date', 'amount', 'amount_difference', 'status', 'original_file_name', 'uploaded_at', 'validation_note'])->unique('payable_id')->keyBy('payable_id');
        $payouts = DB::table('fin_payable_payouts')->whereIn('payable_id', $ids)->orderBy('paid_on')->get(['payable_id', 'code', 'paid_on', 'amount', 'method', 'operation_ref'])->groupBy('payable_id');

        return $rows->map(function (object $row) use ($today, $invoices, $payouts): array {
            $amount = (float) $row->amount;
            $paid = (float) $row->paid_amount;
            $status = PayableDirectory::status($row->status, $amount, $paid, $row->due_date, $row->approved_at !== null, $today);
            $invoice = $invoices[$row->id] ?? null;
            $balance = round($amount - $paid, 2);

            return [
                'code' => $row->code,
                'reservation' => $row->reservation_code,
                'service' => $row->service_name,
                'concept' => $row->concept,
                'amount' => $amount,
                'paid' => $paid,
                'balance' => $balance,
                'currency' => $row->currency,
                'due_date' => $row->due_date,
                'scheduled_date' => $row->scheduled_date,
                'days_to' => (int) Carbon::parse($today)->diffInDays(Carbon::parse($row->scheduled_date ?? $row->due_date), false),
                'status' => $status,
                'supplier_doc' => $row->supplier_doc_number,
                'invoice' => $invoice ? [
                    'number' => $invoice->number,
                    'issue_date' => $invoice->issue_date,
                    'amount' => (float) $invoice->amount,
                    'difference' => (float) $invoice->amount_difference,
                    'status' => $invoice->status,
                    'file' => $invoice->original_file_name,
                    'uploaded_at' => $this->iso($invoice->uploaded_at),
                    'note' => $invoice->validation_note,
                ] : null,
                'can_invoice' => $status !== 'pagada' && $balance > ReceivableLedger::TOLERANCE && ($invoice === null || ! in_array($invoice->status, ['registrada', 'validada'], true)),
                'payouts' => collect($payouts[$row->id] ?? [])->map(fn ($payout): array => ['code' => $payout->code, 'paid_on' => $payout->paid_on, 'amount' => (float) $payout->amount, 'method' => PayableDirectory::PAYOUT_METHODS[$payout->method] ?? $payout->method, 'reference' => $payout->operation_ref])->values(),
            ];
        });
    }

    private function alerts(SupplierAccount $account, Collection $pending, Collection $open, array $contract): array
    {
        $alerts = [];
        $overdue = $pending->where('overdue', true);

        if ($overdue->isNotEmpty()) {
            $alerts[] = ['kind' => 'request', 'tone' => 'bad', 'title' => $overdue->count() === 1 ? 'Una solicitud superó el plazo de respuesta' : "{$overdue->count()} solicitudes superaron el plazo de respuesta", 'detail' => 'Mientras no responda, la agencia no puede emitir el voucher al pasajero.', 'href' => '/proveedor/solicitudes'];
        }

        if ($contract['alert'] !== null) {
            $alerts[] = ['kind' => 'contract', 'tone' => $contract['days_left'] < 0 ? 'bad' : 'warn', 'title' => $contract['alert'], 'detail' => 'Coordine la renovación con el área de Compras de la agencia.', 'href' => '/proveedor/empresa'];
        }

        $rooming = $this->operations->pendingRooming($account);
        if ($rooming > 0) {
            $alerts[] = ['kind' => 'rooming', 'tone' => 'warn', 'title' => $rooming === 1 ? 'Una rooming list espera su respuesta' : "{$rooming} rooming lists esperan su respuesta", 'detail' => 'Acuse recibo y confirme las habitaciones para que la agencia cierre la distribución.', 'href' => '/proveedor/rooming'];
        }

        $withoutInvoice = $open->where('can_invoice', true);
        if ($withoutInvoice->isNotEmpty()) {
            $alerts[] = ['kind' => 'invoice', 'tone' => 'info', 'title' => $withoutInvoice->count() === 1 ? 'Un documento espera su factura' : "{$withoutInvoice->count()} documentos esperan su factura", 'detail' => 'La agencia programa el pago cuando registra la factura.', 'href' => '/proveedor/pagos'];
        }

        $reviewed = DB::table('supplier_rate_requests')->where('provider_id', $account->id())->whereIn('status', ['aprobada', 'rechazada'])->where('reviewed_at', '>=', Carbon::now()->subDays(15))->orderByDesc('reviewed_at')->first(['code', 'status']);
        if ($reviewed !== null) {
            $alerts[] = ['kind' => 'rate', 'tone' => $reviewed->status === 'aprobada' ? 'ok' : 'warn', 'title' => "Solicitud {$reviewed->code} ".($reviewed->status === 'aprobada' ? 'aprobada' : 'rechazada'), 'detail' => 'Revise el detalle en Tarifas.', 'href' => '/proveedor/tarifas'];
        }

        $rate = DB::table('supplier_rate_requests')->where('provider_id', $account->id())->where('status', 'pendiente')->count();
        if ($rate > 0) {
            $alerts[] = ['kind' => 'rate', 'tone' => 'violet', 'title' => $rate === 1 ? 'Una actualización de tarifa en revisión' : "{$rate} actualizaciones de tarifa en revisión", 'detail' => 'La agencia le confirmará la decisión antes de la fecha propuesta.', 'href' => '/proveedor/tarifas'];
        }

        return $alerts;
    }

    private function contract(SupplierAccount $account): array
    {
        $daysLeft = (int) Carbon::parse($this->today())->diffInDays(Carbon::parse($account->provider->contract_end), false);

        return [
            'start' => $account->provider->contract_start,
            'end' => $account->provider->contract_end,
            'days_left' => $daysLeft,
            'alert' => match (true) {
                $daysLeft < 0 => 'Su contrato con la agencia está vencido',
                $daysLeft < self::CONTRACT_WARNING_DAYS => "Su contrato vence en {$daysLeft} días",
                default => null,
            },
        ];
    }

    private function pickup(object $service): ?string
    {
        $snapshot = DB::table('booking_reservation_web_snapshots')->where('reservation_id', $service->reservation_id)->when($service->product_id, fn ($query) => $query->where('product_id', $service->product_id))->first(['pickup_point', 'pickup_address']);
        $web = $snapshot ? trim(implode(' · ', array_filter([$snapshot->pickup_point, $snapshot->pickup_address]))) : '';

        if ($web !== '') {
            return $web;
        }

        $meeting = $service->departure_id ? DB::table('catalog_product_departures')->where('id', $service->departure_id)->value('meeting_point') : null;

        return $meeting ?: ($service->product_id ? DB::table('catalog_products')->where('id', $service->product_id)->value('pickup_text') : null);
    }

    private function rooming(SupplierAccount $account, string $reservationId): ?array
    {
        $list = DB::table('ops_rooming_lists')->where('reservation_id', $reservationId)->where('hotel_provider_id', $account->id())->whereNull('deleted_at')->orderByDesc('created_at')->first(['id', 'check_in', 'check_out', 'status', 'hotel_ack_at', 'hotel_confirmed_at']);

        if ($list === null) {
            return null;
        }

        return [
            'check_in' => $list->check_in,
            'check_out' => $list->check_out,
            'status' => $list->status,
            'acknowledged_at' => $this->iso($list->hotel_ack_at),
            'confirmed_at' => $this->iso($list->hotel_confirmed_at),
            'rooms' => DB::table('ops_rooming_rooms')->where('rooming_list_id', $list->id)->count(),
        ];
    }

    private function history(SupplierAccount $account, string $serviceId): array
    {
        $requests = DB::table('ops_supplier_requests')->where('reservation_service_id', $serviceId)->where('provider_id', $account->id())->whereNull('deleted_at')->get(['requested_at', 'channel'])
            ->map(fn (object $row): array => ['key' => "req-{$row->requested_at}", 'kind' => 'solicitud', 'at' => $this->iso($row->requested_at), 'title' => 'Solicitud enviada por la agencia', 'detail' => 'Canal: '.str_replace('_', ' ', $row->channel), 'note' => null]);
        $responses = DB::table('supplier_request_responses as x')->leftJoin('iam_users as u', 'u.id', '=', 'x.responded_by_user_id')->where('x.reservation_service_id', $serviceId)->where('x.provider_id', $account->id())
            ->get(['x.id', 'x.type', 'x.responded_at', 'x.confirmation_code', 'x.confirmed_by_name', 'x.rejection_reason', 'x.alt_kind', 'x.alt_date', 'x.alt_net_cost', 'x.currency', 'x.review_status', 'x.note', 'u.name as user_name'])
            ->map(fn (object $row): array => [
                'key' => (string) $row->id,
                'kind' => $row->type,
                'at' => $this->iso($row->responded_at),
                'title' => match ($row->type) {
                    'confirmacion' => "Confirmado con código {$row->confirmation_code}",
                    'alternativa' => "Alternativa propuesta: {$row->alt_kind}".match ($row->review_status) {
                        'aceptada' => ' · aceptada por la agencia',
                        'rechazada' => ' · rechazada por la agencia',
                        'expirada' => ' · venció el bloqueo',
                        default => ' · en revisión',
                    },
                    default => "Rechazado: {$row->rejection_reason}",
                },
                'detail' => trim(($row->type === 'confirmacion' ? "Por {$row->confirmed_by_name}" : '').($row->user_name ? " · {$row->user_name}" : ''), ' ·'),
                'note' => trim(($row->note ?? '').($row->alt_date ? " Propuso otra fecha: {$row->alt_date}." : '')) ?: null,
            ]);

        return $requests->concat($responses)->sortBy('at')->values()->all();
    }

    private function iso(?string $value): ?string
    {
        return $value === null ? null : Carbon::parse($value)->toIso8601String();
    }

    private function today(): string
    {
        return Carbon::now($this->context->timezone())->toDateString();
    }

    private function catalogOptions(SupplierAccount $account): array
    {
        return DB::table('catalog_services')->where('provider_id', $account->id())->whereNull('deleted_at')->where('status', 'activo')->orderBy('name')->get(['ref', 'name'])
            ->map(fn (object $row): array => ['value' => $row->ref, 'label' => $row->name, 'hint' => $row->ref])->values()->all();
    }

    private function relatedService(object $service): array
    {
        return ['code' => $service->code, 'date' => $service->service_date, 'status' => $service->status];
    }

    private function byCurrency(Collection $rows, string $field): array
    {
        return $rows->groupBy('currency')->map(fn (Collection $group): float => round((float) $group->sum($field), 2))->filter(fn (float $value): bool => $value > 0)->all();
    }

    private function initials(string $name): string
    {
        return collect(preg_split('/\s+/', trim($name)) ?: [])->reject(fn (string $word): bool => in_array(Str::lower($word), ['de', 'del', 'la', 'el', 'y', 's.a.c.', 'e.i.r.l.', 'hotel'], true))->take(2)->map(fn (string $word): string => Str::upper(mb_substr($word, 0, 1)))->implode('') ?: 'PR';
    }
}
