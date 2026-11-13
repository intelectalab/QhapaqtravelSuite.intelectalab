<?php

declare(strict_types=1);

namespace App\Domain\Marketing\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Marketing\Actions\CampaignWorkflow;
use App\Domain\Marketing\Actions\TemplateWorkflow;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class CampaignDirectory
{
    public const STATUSES = ['borrador' => 'Borrador', 'programada' => 'Programada', 'enviando' => 'Enviando', 'enviada' => 'Enviada', 'cancelada' => 'Cancelada'];

    public const CHANNELS = ['email' => 'Email', 'whatsapp' => 'WhatsApp'];

    public const RECIPIENT_STATUSES = ['pendiente' => 'En cola', 'enviado' => 'Enviado', 'entregado' => 'Entregado', 'rebotado' => 'Rebotado', 'fallido' => 'Fallido'];

    private const WINDOW_DAYS = 30;

    public function __construct(private readonly ContactBook $contacts) {}

    public function overview(User $viewer): array
    {
        $segments = DB::table('mkt_segments')->whereNull('deleted_at')->orderBy('code')->get();
        $templates = DB::table('mkt_templates')->orderBy('code')->get();
        $rows = DB::table('mkt_campaigns as c')->leftJoin('iam_users as u', 'u.id', '=', 'c.owner_id')->orderByDesc('c.created_at')->get(['c.*', 'u.name as owner']);
        $recipients = DB::table('mkt_campaign_recipients')->whereIn('campaign_id', $rows->pluck('id'))->get()->groupBy('campaign_id');
        $tests = DB::table('mkt_campaign_tests')->whereIn('campaign_id', $rows->pluck('id'))->whereNull('invalidated_at')->get(['campaign_id', 'to_address', 'sent_at'])->groupBy('campaign_id');
        $segmentById = $segments->keyBy('id');
        $templateById = $templates->keyBy('id');
        $campaigns = $rows->map(fn (object $row): array => $this->campaign($row, $recipients->get($row->id, collect()), $tests->get($row->id, collect()), $segmentById, $templateById));
        $sent = $campaigns->where('status', 'enviada')->filter(fn (array $campaign): bool => $campaign['sent_at'] !== null && Carbon::parse($campaign['sent_at'])->gte(Carbon::now()->subDays(90)));
        $delivered = $sent->sum('metrics.delivered');
        $all = $this->contacts->all();

        return [
            'kpis' => [
                'sent_90' => $sent->count(),
                'recipients_90' => $sent->sum('metrics.recipients'),
                'delivered_90' => $delivered,
                'open_rate' => $delivered > 0 ? round($sent->sum('metrics.opened') / $delivered * 100, 1) : null,
                'click_rate' => $delivered > 0 ? round($sent->sum('metrics.clicked') / $delivered * 100, 1) : null,
                'revenue' => round($sent->sum('attribution.revenue'), 2),
                'reservations' => $sent->sum('attribution.reservations'),
                'contactable_email' => $all->filter(fn (array $contact): bool => $contact['consent']['email'] && $contact['email'])->count(),
                'contactable_whatsapp' => $all->filter(fn (array $contact): bool => $contact['consent']['whatsapp'] && $contact['mobile'])->count(),
                'contacts' => $all->count(),
            ],
            'campaigns' => $campaigns->values(),
            'segments' => $this->segmentRows($segments, $campaigns->pluck('segment.code')->filter()->countBy()->all()),
            'templates' => $this->templateRows($templates, $campaigns->pluck('template.code')->filter()->countBy()->all()),
            'segment_fields' => $this->contacts->catalog(),
            'variables' => TemplateWorkflow::VARIABLES,
            'codes' => $this->codes($campaigns),
            'consents' => [
                'email' => DB::table('mkt_consents')->where('channel', 'email')->where('status', 'otorgado')->count(),
                'whatsapp' => DB::table('mkt_consents')->where('channel', 'whatsapp')->where('status', 'otorgado')->count(),
                'revoked_30' => DB::table('mkt_consents')->where('status', 'revocado')->where('revoked_at', '>=', Carbon::now()->subDays(30))->count(),
                'subscribers' => DB::table('mkt_contacts_subscribers')->whereNull('deleted_at')->count(),
            ],
            'test_options' => [
                'recipients' => DB::table('iam_users as u')->join('model_has_roles as mr', 'mr.model_id', '=', 'u.id')->join('roles as r', 'r.id', '=', 'mr.role_id')
                    ->whereIn('r.name', CampaignWorkflow::TEST_ROLES)->where('u.status', 'activo')->whereNull('u.deleted_at')->orderBy('u.name')->distinct()
                    ->get(['u.id', 'u.name', 'u.email', 'u.phone'])
                    ->map(fn (object $user): array => ['value' => $user->id, 'label' => $user->name, 'email' => $user->email, 'phone' => $user->phone])->values(),
                'samples' => $all->filter(fn (array $contact): bool => $contact['type'] !== 'subscriber')->take(30)
                    ->map(fn (array $contact): array => ['value' => $contact['code'], 'label' => $contact['name'], 'hint' => $contact['code']])->values(),
                'me' => $viewer->getKey(),
            ],
            'can' => ['manage' => $viewer->can('marketing.campaigns.manage')],
        ];
    }

    public function detail(string $code, User $viewer): array
    {
        $row = DB::table('mkt_campaigns as c')->leftJoin('iam_users as u', 'u.id', '=', 'c.owner_id')->where('c.code', $code)->first(['c.*', 'u.name as owner'])
            ?? throw ApiException::notFound('La campaña no existe.');
        $recipients = DB::table('mkt_campaign_recipients')->where('campaign_id', $row->id)->get();
        $tests = DB::table('mkt_campaign_tests')->where('campaign_id', $row->id)->whereNull('invalidated_at')->get(['campaign_id', 'to_address', 'sent_at']);
        $segments = DB::table('mkt_segments')->where('id', $row->segment_id)->get()->keyBy('id');
        $templates = DB::table('mkt_templates')->where('id', $row->template_id)->get()->keyBy('id');
        $campaign = $this->campaign($row, $recipients, $tests, $segments, $templates);

        return [
            ...$campaign,
            'recipient_statuses' => collect(self::RECIPIENT_STATUSES)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label, 'count' => $recipients->where('status', $value)->count()])->values()->all(),
            'history' => DB::table('audit_events as e')->leftJoin('iam_users as u', 'u.id', '=', 'e.actor_id')->where('e.entity', 'Campaña')->where('e.entity_id', $row->code)
                ->orderByDesc('e.occurred_at')->limit(30)->get(['e.action', 'e.before_value', 'e.after_value', 'e.occurred_at', 'u.name as by'])
                ->map(fn (object $event): array => ['action' => $event->action, 'before' => $event->before_value, 'detail' => $event->after_value, 'at' => $event->occurred_at, 'by' => $event->by ?? 'Sistema'])->all(),
            'can' => ['manage' => $viewer->can('marketing.campaigns.manage'), 'edit' => $row->status === 'borrador'],
        ];
    }

    public function audienceOf(string $code, ?Carbon $at = null): array
    {
        $campaign = DB::table('mkt_campaigns')->where('code', $code)->first(['id', 'code', 'channel', 'status', 'segment_id', 'audience_snapshot', 'sent_at'])
            ?? throw ApiException::notFound('La campaña no existe.');
        $names = $this->contacts->all()->keyBy(fn (array $contact): string => "{$contact['type']}:{$contact['id']}");

        if ($campaign->audience_snapshot !== null) {
            $snapshot = json_decode((string) $campaign->audience_snapshot, true) ?: [];
            $suppressed = DB::table('mkt_campaign_suppressions')->where('campaign_id', $campaign->id)->orderBy('reason')->get(['subject_type', 'subject_id', 'reason'])
                ->map(fn (object $row): array => $this->suppressedRow($names->get("{$row->subject_type}:{$row->subject_id}"), (string) $row->subject_type, (string) $row->subject_id, (string) $row->reason))->values()->all();

            return ['code' => $campaign->code, 'snapshot' => true, 'at' => $snapshot['at'] ?? $campaign->sent_at, 'summary' => $this->summary($snapshot), 'suppressed' => $suppressed];
        }

        $segment = DB::table('mkt_segments')->where('id', $campaign->segment_id)->first(['match', 'rules']);

        if ($segment === null) {
            return ['code' => $campaign->code, 'snapshot' => false, 'at' => ($at ?? now())->toIso8601String(), 'summary' => $this->summary([]), 'suppressed' => []];
        }

        $when = $at ?? now();
        $fatigued = DB::table('mkt_campaign_recipients as r')->join('mkt_campaigns as c', 'c.id', '=', 'r.campaign_id')
            ->where('c.id', '!=', $campaign->id)->whereIn('c.status', ['enviando', 'enviada'])->whereBetween('c.sent_at', [$when->copy()->subHours(72), $when])
            ->get(['r.subject_type', 'r.subject_id'])->mapWithKeys(fn (object $row): array => ["{$row->subject_type}:{$row->subject_id}" => true])->all();
        $split = $this->contacts->split($segment->match, json_decode((string) $segment->rules, true) ?: [], $campaign->channel, $fatigued);
        $suppressed = collect($split['suppressed'])->flatMap(fn (array $contacts, string $reason) => collect($contacts)->map(fn (array $contact): array => $this->suppressedRow($contact, $contact['type'], $contact['id'], $reason)))->values()->all();

        return [
            'code' => $campaign->code,
            'snapshot' => false,
            'at' => $when->toIso8601String(),
            'summary' => $this->summary(['matched' => $split['matched'], 'eligible' => count($split['eligible']), ...array_map('count', $split['suppressed'])]),
            'suppressed' => $suppressed,
        ];
    }

    public function segments(): array
    {
        $usage = DB::table('mkt_campaigns as c')->join('mkt_segments as s', 's.id', '=', 'c.segment_id')->pluck('s.code')->countBy()->all();

        return $this->segmentRows(DB::table('mkt_segments')->whereNull('deleted_at')->orderBy('code')->get(), $usage)->all();
    }

    public function templates(): array
    {
        $usage = DB::table('mkt_campaigns as c')->join('mkt_templates as t', 't.id', '=', 'c.template_id')->pluck('t.code')->countBy()->all();

        return $this->templateRows(DB::table('mkt_templates')->orderBy('code')->get(), $usage)->all();
    }

    public function segment(string $code): array
    {
        $row = DB::table('mkt_segments as s')->leftJoin('iam_users as u', 'u.id', '=', 's.owner_id')->whereNull('s.deleted_at')->where('s.code', $code)->first(['s.*', 'u.name as owner'])
            ?? throw ApiException::notFound('El segmento no existe.');
        $rules = json_decode((string) $row->rules, true) ?: [];

        return [
            'code' => $row->code,
            'lock_version' => (int) $row->lock_version,
            'name' => $row->name,
            'description' => $row->description,
            'match' => $row->match,
            'rules' => $rules,
            'owner' => $row->owner,
            'updated_at' => $row->updated_at,
            'preview' => $this->contacts->preview($row->match, $rules),
            'campaigns' => DB::table('mkt_campaigns')->where('segment_id', $row->id)->orderByDesc('created_at')->get(['code', 'name', 'status'])
                ->map(fn (object $campaign): array => ['code' => $campaign->code, 'name' => $campaign->name, 'status' => $campaign->status, 'status_label' => self::STATUSES[$campaign->status] ?? $campaign->status])->all(),
            'history' => DB::table('audit_events as e')->leftJoin('iam_users as u', 'u.id', '=', 'e.actor_id')->where('e.entity', 'Segmento')->where('e.entity_id', $row->code)
                ->orderByDesc('e.occurred_at')->limit(20)->get(['e.action', 'e.after_value', 'e.occurred_at', 'u.name as by'])
                ->map(fn (object $event): array => ['action' => $event->action, 'detail' => $event->after_value, 'at' => $event->occurred_at, 'by' => $event->by])->all(),
        ];
    }

    private function summary(array $values): array
    {
        return [
            'matched' => (int) ($values['matched'] ?? 0),
            'eligible' => (int) ($values['eligible'] ?? 0),
            'reasons' => collect(ContactBook::SUPPRESSIONS)->map(fn (string $label, string $reason): array => ['reason' => $reason, 'label' => $label, 'count' => (int) ($values[$reason] ?? 0)])->values()->all(),
        ];
    }

    private function suppressedRow(?array $contact, string $type, string $id, string $reason): array
    {
        return [
            'type' => $type,
            'id' => $id,
            'name' => $contact['name'] ?? 'Contacto sin datos',
            'reason' => $reason,
            'reason_label' => ContactBook::SUPPRESSIONS[$reason] ?? $reason,
        ];
    }

    private function segmentRows(Collection $segments, array $usage): Collection
    {
        $owners = DB::table('iam_users')->whereIn('id', $segments->pluck('owner_id')->filter()->unique())->pluck('name', 'id');

        return $segments->map(function ($row) use ($usage, $owners): array {
            $rules = json_decode((string) $row->rules, true) ?: [];
            $email = $this->contacts->audience($row->match, $rules, 'email');
            $whatsapp = $this->contacts->audience($row->match, $rules, 'whatsapp');

            return [
                'code' => $row->code,
                'lock_version' => (int) $row->lock_version,
                'name' => $row->name,
                'description' => $row->description,
                'match' => $row->match,
                'rules' => $rules,
                'rules_text' => $this->contacts->describe($rules, $row->match),
                'rules_parts' => $this->contacts->parts($rules),
                'matched' => $email['matched'],
                'email' => $email['eligible'],
                'whatsapp' => $whatsapp['eligible'],
                'campaigns' => (int) ($usage[$row->code] ?? 0),
                'owner' => $owners[$row->owner_id] ?? null,
                'updated_at' => $row->updated_at,
            ];
        })->values();
    }

    private function templateRows(Collection $templates, array $usage): Collection
    {
        return $templates->map(fn ($row): array => [
            'code' => $row->code,
            'lock_version' => (int) $row->lock_version,
            'name' => $row->name,
            'channel' => $row->channel,
            'category' => $row->category,
            'category_label' => TemplateWorkflow::CATEGORIES[$row->category] ?? $row->category,
            'status' => $row->status,
            'subject' => $row->subject,
            'body' => $row->body,
            'provider_template_id' => $row->provider_template_id,
            'reviewed_at' => $row->reviewed_at,
            'updated_at' => $row->updated_at,
            'uses' => (int) ($usage[$row->code] ?? 0),
            'usable' => $row->channel === 'email' ? $row->status === 'activa' : $row->status === 'aprobada',
        ])->values();
    }

    private function campaign(object $row, Collection $recipients, Collection $tests, Collection $segments, Collection $templates): array
    {
        $segment = $segments->get($row->segment_id);
        $template = $templates->get($row->template_id);
        $total = $recipients->count();
        $delivered = $recipients->whereIn('status', ['entregado'])->count();
        $audience = $row->audience_snapshot ? json_decode((string) $row->audience_snapshot, true) : null;

        if ($audience === null && $segment !== null && in_array($row->status, ['borrador', 'programada'], true)) {
            $audience = $this->contacts->audience($segment->match, json_decode((string) $segment->rules, true) ?: [], $row->channel);
        }

        return [
            'code' => $row->code,
            'lock_version' => (int) $row->lock_version,
            'name' => $row->name,
            'channel' => $row->channel,
            'channel_label' => self::CHANNELS[$row->channel] ?? $row->channel,
            'status' => $row->status,
            'status_label' => self::STATUSES[$row->status] ?? $row->status,
            'segment' => $segment ? ['code' => $segment->code, 'name' => $segment->name] : null,
            'template' => $template ? ['code' => $template->code, 'name' => $template->name, 'status' => $template->status] : null,
            'subject' => $row->subject,
            'body' => $row->body,
            'promo_code' => $row->promo_code,
            'utm' => $row->utm,
            'scheduled_at' => $row->scheduled_at,
            'sent_at' => $row->sent_at,
            'created_at' => $row->created_at,
            'cancel_reason' => $row->cancel_reason,
            'owner' => $row->owner,
            'audience' => $audience,
            'tests' => $tests->map(fn ($test): array => ['to' => $test->to_address, 'at' => $test->sent_at])->values(),
            'metrics' => [
                'recipients' => $total,
                'delivered' => $delivered,
                'opened' => $recipients->whereNotNull('opened_at')->count(),
                'clicked' => $recipients->whereNotNull('clicked_at')->count(),
                'replied' => $recipients->whereNotNull('replied_at')->count(),
                'unsubscribed' => $recipients->whereNotNull('unsubscribed_at')->count(),
                'failed' => $recipients->whereIn('status', ['rebotado', 'fallido'])->count(),
            ],
            'attribution' => $row->status === 'enviada' ? $this->attribution($row, $recipients) : ['reservations' => 0, 'revenue' => 0.0, 'items' => []],
        ];
    }

    private function attribution(object $campaign, Collection $recipients): array
    {
        $clients = $recipients->where('subject_type', 'client')->pluck('subject_id')->all();

        if ($clients === [] || $campaign->sent_at === null) {
            return ['reservations' => 0, 'revenue' => 0.0, 'items' => []];
        }

        $sent = Carbon::parse($campaign->sent_at);
        $rows = DB::table('booking_reservations as r')->leftJoin('quote_quotes as q', 'q.id', '=', 'r.quote_id')
            ->whereNull('r.deleted_at')->whereNotIn('r.status', ['borrador', 'cancelada'])->whereIn('r.client_id', $clients)
            ->where('r.created_at', '>', $sent)->where('r.created_at', '<=', $sent->copy()->addDays(self::WINDOW_DAYS))
            ->where(fn ($query) => $query->whereNull('q.created_at')->orWhere('q.created_at', '>', $sent))
            ->get(['r.code', 'r.title', 'r.total_amount', 'r.fx_rate', 'r.created_at']);

        return [
            'reservations' => $rows->count(),
            'revenue' => round($rows->sum(fn (object $row): float => (float) $row->total_amount * (float) $row->fx_rate), 2),
            'items' => $rows->map(fn (object $row): array => ['code' => $row->code, 'title' => $row->title, 'total_pen' => round((float) $row->total_amount * (float) $row->fx_rate, 2)])->values()->all(),
        ];
    }

    private function codes(Collection $campaigns): array
    {
        $promotions = DB::table('catalog_product_promotions as p')->join('catalog_products as c', 'c.id', '=', 'p.product_id')
            ->whereNull('p.deleted_at')->whereNotNull('p.promo_code')
            ->get(['p.promo_code', 'p.kind', 'p.value', 'p.date_from', 'p.date_to', 'p.status', 'c.name as product'])->keyBy('promo_code');
        $codes = $campaigns->pluck('promo_code')->filter()->merge($promotions->keys())->unique()->values();

        return $codes->map(function (string $code) use ($promotions, $campaigns): array {
            $promotion = $promotions->get($code);

            return [
                'code' => $code,
                'product' => $promotion->product ?? null,
                'kind' => $promotion->kind ?? null,
                'value' => $promotion ? (float) $promotion->value : null,
                'valid_to' => $promotion->date_to ?? null,
                'status' => $promotion->status ?? null,
                'campaigns' => $campaigns->where('promo_code', $code)->map(fn (array $campaign): array => ['code' => $campaign['code'], 'name' => $campaign['name'], 'status' => $campaign['status']])->values()->all(),
            ];
        })->all();
    }
}
