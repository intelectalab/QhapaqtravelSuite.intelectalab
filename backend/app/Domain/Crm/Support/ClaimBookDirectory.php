<?php

declare(strict_types=1);

namespace App\Domain\Crm\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class ClaimBookDirectory
{
    public const CHANNELS = ['web' => 'Sitio web', 'customer_portal' => 'Portal del cliente', 'passenger_portal' => 'Portal del pasajero', 'in_person' => 'Presencial'];

    public const BOOK_STATUS = ['received' => 'Recibida', 'in_review' => 'En evaluación', 'answered' => 'Respondida', 'closed' => 'Cerrada'];

    public const TYPES = ['reclamo' => 'Reclamo', 'queja' => 'Queja'];

    public function __construct(private readonly TenantContext $context, private readonly BusinessDays $days) {}

    public function settings(): object
    {
        return DB::table('crm_claim_book_settings')->first() ?? (object) ['response_days' => 15, 'alert_days' => 3, 'retention_years' => 2];
    }

    public function overview(User $viewer): array
    {
        $settings = $this->settings();
        $today = Carbon::now($this->context->timezone())->startOfDay();
        $rows = DB::table('crm_cases as k')->where('k.is_book', true)
            ->leftJoin('iam_sedes as s', 's.id', '=', 'k.sede_id')
            ->leftJoin('crm_clients as c', 'c.id', '=', 'k.client_id')
            ->leftJoin('booking_reservations as r', 'r.id', '=', 'k.reservation_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'k.owner_id')
            ->orderByDesc('k.received_at')
            ->get(['k.*', 's.name as sede', 'c.code as client_code', 'c.name as client', 'r.code as reservation', 'u.name as owner']);
        $events = DB::table('crm_case_events as e')->leftJoin('iam_users as u', 'u.id', '=', 'e.user_id')->whereIn('e.case_id', $rows->pluck('id'))->orderBy('e.created_at')
            ->get(['e.case_id', 'e.message', 'e.created_at', 'u.name'])->groupBy('case_id');
        $claims = $rows->map(fn ($row): array => $this->present($row, $events->get($row->id, collect()), (int) $settings->alert_days, $today));
        $answered = $claims->filter(fn (array $claim): bool => $claim['response'] !== null && $claim['response']['answered_at'] !== null);
        $month = $today->format('Y-m');

        return [
            'today' => $today->toDateString(),
            'settings' => ['response_days' => (int) $settings->response_days, 'alert_days' => (int) $settings->alert_days, 'retention_years' => (int) $settings->retention_years],
            'kpis' => [
                'month' => $claims->filter(fn (array $claim): bool => str_starts_with((string) $claim['received_on'], $month))->count(),
                'open' => $claims->whereIn('book_status', ['received', 'in_review'])->count(),
                'due_soon' => $claims->where('deadline', 'por_vencer')->count(),
                'overdue' => $claims->where('deadline', 'vencido')->count(),
                'avg_days' => $answered->isEmpty() ? null : round($answered->avg('business_days_to_answer'), 1),
                'on_time_pct' => $answered->isEmpty() ? null : (int) round($answered->where('deadline', 'respondido_en_plazo')->count() / $answered->count() * 100),
            ],
            'by_type' => $this->group($claims, 'type'),
            'by_sede' => $this->group($claims, 'sede'),
            'claims' => $claims->values(),
            'options' => [
                'sedes' => DB::table('iam_sedes')->orderBy('code')->get(['id', 'name'])->map(fn (object $row): array => ['value' => $row->id, 'label' => $row->name])->values(),
                'clients' => DB::table('crm_clients')->whereNull('deleted_at')->orderBy('name')->get(['code', 'name'])->map(fn (object $row): array => ['value' => $row->code, 'label' => $row->name])->values(),
                'reservations' => DB::table('booking_reservations')->whereNull('deleted_at')->orderByDesc('created_at')->limit(100)->get(['code', 'title'])->map(fn (object $row): array => ['value' => $row->code, 'label' => $row->title, 'hint' => $row->code])->values(),
            ],
            'can' => ['manage' => $viewer->can('crm.claims.manage'), 'settings' => $viewer->can('admin.settings.manage')],
        ];
    }

    private function present(object $row, Collection $events, int $alertDays, Carbon $today): array
    {
        $response = $row->response ? json_decode((string) $row->response, true) : null;
        $consumer = $row->consumer ? json_decode((string) $row->consumer, true) : [];
        $good = $row->good ? json_decode((string) $row->good, true) : null;
        $due = $row->due_date ? Carbon::parse($row->due_date) : null;
        $received = Carbon::parse($row->received_at ?? $row->created_at)->setTimezone($this->context->timezone());
        $answeredAt = $response && ($response['sent_at'] ?? $response['answered_at'] ?? null) ? Carbon::parse($response['sent_at'] ?? $response['answered_at'])->setTimezone($this->context->timezone()) : null;
        $left = $due ? $this->days->between($today, $due) : null;

        $deadline = match (true) {
            $answeredAt !== null => $due && $answeredAt->copy()->startOfDay()->gt($due) ? 'respondido_fuera_de_plazo' : 'respondido_en_plazo',
            $row->book_status === 'closed' => 'respondido_en_plazo',
            $left !== null && $left < 0 => 'vencido',
            $left !== null && $left <= $alertDays => 'por_vencer',
            default => 'en_plazo',
        };

        return [
            'code' => $row->code,
            'book_number' => $row->book_number,
            'type_code' => $row->type_code,
            'type' => self::TYPES[$row->type_code] ?? ucfirst((string) $row->type_code),
            'priority' => $row->priority,
            'subject' => $row->subject,
            'detail' => $row->detail ?? $row->description,
            'request' => $row->request,
            'sede' => $row->sede,
            'sede_id' => $row->sede_id,
            'channel' => $row->channel,
            'channel_label' => self::CHANNELS[$row->channel] ?? $row->channel,
            'book_status' => $row->book_status,
            'book_status_label' => self::BOOK_STATUS[$row->book_status] ?? $row->book_status,
            'consumer' => [
                'name' => $consumer['name'] ?? 'Consumidor',
                'doc_type' => $consumer['docType'] ?? $consumer['doc_type'] ?? null,
                'doc_number' => $consumer['docNumber'] ?? $consumer['doc_number'] ?? null,
                'email' => $consumer['email'] ?? null,
                'phone' => $consumer['phone'] ?? null,
                'address' => $consumer['address'] ?? null,
                'minor' => (bool) ($consumer['minor'] ?? $consumer['is_minor'] ?? false),
            ],
            'good' => $good ? ['kind' => $good['kind'] ?? 'Servicio', 'description' => $good['description'] ?? '', 'amount' => (float) ($good['amount'] ?? 0), 'currency' => $good['currency'] ?? 'PEN'] : null,
            'received_at' => $row->received_at,
            'received_on' => $received->toDateString(),
            'due_date' => $row->due_date,
            'days_left' => $left,
            'deadline' => $deadline,
            'business_days_to_answer' => $answeredAt ? $this->days->between($received, $answeredAt) : null,
            'response' => $response ? [
                'decision' => $response['decision'] ?? null,
                'text' => $response['text'] ?? null,
                'actions' => $response['actions'] ?? null,
                'answered_at' => $response['answered_at'] ?? null,
                'sent_at' => $response['sent_at'] ?? null,
                'sent_to' => $response['sent_to'] ?? null,
            ] : null,
            'close_note' => $row->close_note,
            'closed_at' => $row->closed_at,
            'client' => $row->client_code ? ['code' => $row->client_code, 'name' => $row->client] : null,
            'reservation' => $row->reservation,
            'owner' => $row->owner,
            'log' => $events->map(fn ($event): array => ['message' => $event->message, 'at' => $event->created_at, 'by' => $event->name ?? 'Consumidor'])->values(),
        ];
    }

    private function group(Collection $claims, string $field): array
    {
        return $claims->groupBy($field)->map(fn (Collection $items, string $label): array => ['label' => $label ?: 'Sin dato', 'count' => $items->count()])->sortByDesc('count')->values()->all();
    }
}
