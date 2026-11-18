<?php

declare(strict_types=1);

namespace App\Domain\Growth\Recovery;

use App\Domain\Growth\Shared\GrowthRules;
use App\Domain\Integrations\Contracts\MessagingChannel;
use App\Domain\Integrations\Data\OutboundMessage;
use App\Domain\Marketing\Support\ContactBook;
use App\Domain\Platform\Support\UsageMeter;
use App\Domain\Quotes\Actions\QuoteAccessTokens;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Site\Actions\NewsletterLifecycle;
use App\Jobs\SendCampaign;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class RecoveryDispatcher
{
    public const QUOTE_WAITING = ['enviada', 'vista'];

    private const OPEN = ['programado', 'enviado'];

    private ?Collection $book = null;

    public function __construct(
        private readonly GrowthRules $rules,
        private readonly ContactBook $contacts,
        private readonly MessagingChannel $channel,
        private readonly TenantContext $context,
        private readonly QuoteAccessTokens $tokens,
    ) {}

    public function run(): ?array
    {
        if (! $this->rules->enabled('R-CART-RECOVERY')) {
            return null;
        }

        $closed = $this->close();
        $scheduled = DB::table('mkt_recovery_flows')->where('active', true)->orderBy('code')->get()->sum(fn (object $flow): int => $this->schedule($flow));

        return [...$closed, 'scheduled' => $scheduled, ...$this->deliver()];
    }

    private function close(): array
    {
        $recovered = 0;
        $discarded = 0;
        $open = DB::table('mkt_recovery_attempts as a')
            ->leftJoin('quote_quotes as q', 'q.id', '=', 'a.quote_id')
            ->leftJoin('channel_web_carts as w', 'w.id', '=', 'a.cart_id')
            ->leftJoin('channel_ecom_orders as o', 'o.id', '=', 'w.order_id')
            ->whereIn('a.status', self::OPEN)
            ->get(['a.id', 'a.flow_id', 'a.cart_id', 'a.quote_id', 'a.attempt_no', 'a.status', 'q.status as quote_status', 'q.reservation_id as quote_reservation', 'q.deleted_at as quote_deleted', 'w.status as cart_status', 'o.reservation_id as cart_reservation']);

        foreach ($open->groupBy(fn (object $row): string => $row->flow_id.'|'.($row->quote_id ?? $row->cart_id)) as $attempts) {
            $first = $attempts->first();
            $reservation = $first->quote_id !== null ? $first->quote_reservation : $first->cart_reservation;
            $pending = $first->quote_id !== null
                ? $first->quote_deleted === null && in_array($first->quote_status, self::QUOTE_WAITING, true)
                : $first->cart_status === 'activo';

            if ($pending) {
                continue;
            }

            $winner = $reservation !== null ? $attempts->where('status', 'enviado')->sortByDesc('attempt_no')->first() : null;

            if ($winner !== null) {
                DB::table('mkt_recovery_attempts')->where('id', $winner->id)->update([
                    'status' => 'recuperado',
                    'recovered_reservation_id' => $reservation,
                    'recovered_amount' => DB::table('booking_reservations')->where('id', $reservation)->value('total_amount'),
                    'updated_at' => now(),
                ]);
                $recovered++;
            }

            $discarded += DB::table('mkt_recovery_attempts')->whereIn('id', $attempts->pluck('id')->reject(fn (string $id): bool => $id === $winner?->id)->all())
                ->update(['status' => 'descartado', 'updated_at' => now()]);
        }

        return ['recovered' => $recovered, 'discarded' => $discarded];
    }

    private function schedule(object $flow): int
    {
        $limit = Carbon::now()->subMinutes((int) $flow->delay_minutes);
        $candidates = $flow->trigger_kind === 'quote' ? $this->waitingQuotes($limit) : $this->idleCarts($limit);
        $history = DB::table('mkt_recovery_attempts')->where('flow_id', $flow->id)
            ->get(['quote_id', 'cart_id', 'attempt_no', 'status', 'scheduled_at', 'sent_at'])
            ->groupBy(fn (object $row): string => (string) ($row->quote_id ?? $row->cart_id));
        $created = 0;

        foreach ($candidates as $candidate) {
            $previous = $history->get($candidate['id'], collect());

            if ($previous->whereIn('status', ['programado', 'recuperado', 'descartado'])->isNotEmpty() || $previous->count() >= (int) $flow->max_attempts) {
                continue;
            }

            $last = $previous->map(fn (object $row): string => (string) ($row->sent_at ?? $row->scheduled_at))->max();

            if ($last !== null && Carbon::parse($last)->greaterThan($limit)) {
                continue;
            }

            $contact = $this->contact($candidate['client_id']);
            $address = $contact[$flow->channel === 'email' ? 'email' : 'mobile'] ?? null;

            DB::table('mkt_recovery_attempts')->insert([
                'id' => (string) Str::uuid7(),
                'flow_id' => $flow->id,
                $flow->trigger_kind === 'quote' ? 'quote_id' : 'cart_id' => $candidate['id'],
                'client_id' => $candidate['client_id'],
                'to_address' => mb_substr((string) ($address ?? 'sin dato'), 0, 160),
                'attempt_no' => $previous->count() + 1,
                'scheduled_at' => now(),
                'status' => 'programado',
            ]);
            $created++;
        }

        return $created;
    }

    private function deliver(): array
    {
        $result = ['sent' => 0, 'skipped' => 0, 'failed' => 0];
        $due = DB::table('mkt_recovery_attempts as a')->join('mkt_recovery_flows as f', 'f.id', '=', 'a.flow_id')
            ->where('a.status', 'programado')->where('a.scheduled_at', '<=', now())->orderBy('a.scheduled_at')
            ->get(['a.id', 'a.quote_id', 'a.cart_id', 'a.client_id', 'f.channel', 'f.template_ref', 'f.include_payment_link']);
        $usage = ['email' => 0, 'whatsapp' => 0];

        foreach ($due as $attempt) {
            $contact = $this->contact($attempt->client_id);
            $address = $contact[$attempt->channel === 'email' ? 'email' : 'mobile'] ?? null;

            if ($contact === null || $address === null || ($contact['revoked'][$attempt->channel] ?? false) || ! ($contact['consent'][$attempt->channel] ?? false)) {
                DB::table('mkt_recovery_attempts')->where('id', $attempt->id)->update(['status' => 'descartado', 'updated_at' => now()]);
                $result['skipped']++;

                continue;
            }

            $sent = $this->channel->send($this->message($attempt, $contact, (string) $address));

            if (! $sent->ok && $sent->errorClass === 'transitorio') {
                continue;
            }

            DB::table('mkt_recovery_attempts')->where('id', $attempt->id)->update([
                'status' => $sent->ok ? 'enviado' : 'fallido',
                'to_address' => mb_substr((string) $address, 0, 160),
                'sent_at' => $sent->ok ? now() : null,
                'updated_at' => now(),
            ]);
            $result[$sent->ok ? 'sent' : 'failed']++;
            $usage[$attempt->channel] += $sent->ok ? 1 : 0;
        }

        $tenant = (string) $this->context->idOrFail();
        UsageMeter::record($tenant, 'email_month', $usage['email']);
        UsageMeter::record($tenant, 'whatsapp_month', $usage['whatsapp']);

        return $result;
    }

    private function message(object $attempt, array $contact, string $address): OutboundMessage
    {
        $origin = $this->origin($attempt);
        $subdomain = (string) $this->context->tenant()->getAttribute('subdomain');
        $variables = [
            'nombre' => Str::before((string) $contact['name'], ' '),
            'destino' => $origin['destination'] !== '' ? $origin['destination'] : (string) $contact['dest'],
            'asesor' => $origin['advisor'],
            'agencia' => (string) $this->context->tenant()->getAttribute('commercial_name'),
            'fecha_viaje' => $origin['travel_from'] !== null ? Carbon::parse($origin['travel_from'])->format('d/m/Y') : '',
            'codigo_promo' => '',
            'enlace' => $origin['link'],
            'enlace_baja' => NewsletterLifecycle::unsubscribeUrl($subdomain, NewsletterLifecycle::contactToken((string) $contact['type'], (string) $contact['id'])),
        ];

        if ($attempt->channel === 'whatsapp') {
            return new OutboundMessage(channel: 'whatsapp', to: $address, templateCode: (string) $attempt->template_ref, variables: $variables);
        }

        $template = DB::table('mkt_templates')->where('code', $attempt->template_ref)->first(['subject', 'body']);
        $body = SendCampaign::render((string) ($template->body ?? ''), $variables);

        if ($attempt->include_payment_link && ! str_contains((string) ($template->body ?? ''), '{{enlace}}')) {
            $body .= "\n\n".($attempt->quote_id !== null ? 'Revisa y aprueba tu propuesta aquí: ' : 'Retoma tu compra aquí: ').$origin['link'];
        }

        return new OutboundMessage(channel: 'email', to: $address, subject: SendCampaign::render((string) ($template->subject ?? 'Tu viaje te espera'), $variables), body: $body, variables: $variables);
    }

    private function origin(object $attempt): array
    {
        if ($attempt->quote_id !== null) {
            $quote = DB::table('quote_quotes as q')->leftJoin('iam_users as u', 'u.id', '=', 'q.owner_id')->where('q.id', $attempt->quote_id)->first(['q.title', 'q.travel_from', 'u.name as advisor']);

            return ['destination' => (string) ($quote->title ?? ''), 'advisor' => (string) ($quote->advisor ?? ''), 'travel_from' => $quote->travel_from ?? null, 'link' => (string) ($this->tokens->state((string) $attempt->quote_id)['url'] ?? '')];
        }

        $product = DB::table('channel_web_cart_items as i')->join('catalog_products as p', 'p.id', '=', 'i.product_id')->where('i.cart_id', $attempt->cart_id)->orderBy('i.line_no')->first(['p.name', 'i.service_date']);

        return [
            'destination' => (string) ($product->name ?? ''),
            'advisor' => '',
            'travel_from' => $product->service_date ?? null,
            'link' => rtrim((string) config('app.frontend_url'), '/').'/sitio/'.$this->context->tenant()->getAttribute('subdomain').'/carrito',
        ];
    }

    private function waitingQuotes(Carbon $limit): Collection
    {
        return DB::table('quote_quotes as q')->whereNull('q.deleted_at')->whereIn('q.status', self::QUOTE_WAITING)->whereNotNull('q.client_id')
            ->where('q.valid_until', '>=', Carbon::now($this->context->timezone())->toDateString())
            ->whereExists(fn ($query) => $query->from('quote_access_tokens as t')->whereColumn('t.quote_id', 'q.id')->whereNull('t.revoked_at'))
            ->whereRaw('coalesce(q.viewed_at, (select max(t.created_at) from quote_access_tokens t where t.quote_id = q.id and t.revoked_at is null)) <= ?', [$limit])
            ->get(['q.id', 'q.client_id'])->map(fn (object $row): array => ['id' => (string) $row->id, 'client_id' => (string) $row->client_id]);
    }

    private function idleCarts(Carbon $limit): Collection
    {
        return DB::table('channel_web_carts as w')->where('w.status', 'activo')->whereNotNull('w.crm_client_id')->where('w.last_activity_at', '<=', $limit)
            ->whereExists(fn ($query) => $query->from('channel_web_cart_items as i')->whereColumn('i.cart_id', 'w.id'))
            ->get(['w.id', 'w.crm_client_id'])->map(fn (object $row): array => ['id' => (string) $row->id, 'client_id' => (string) $row->crm_client_id]);
    }

    private function contact(?string $clientId): ?array
    {
        $this->book ??= $this->contacts->all()->where('type', 'client')->keyBy('id');

        return $clientId === null ? null : $this->book->get($clientId);
    }
}
