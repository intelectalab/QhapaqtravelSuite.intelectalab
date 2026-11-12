<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Integrations\Contracts\MessagingChannel;
use App\Domain\Integrations\Data\OutboundMessage;
use App\Domain\Marketing\Support\ContactBook;
use App\Domain\Platform\Support\EffectiveLimits;
use App\Domain\Platform\Support\UsageMeter;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Tenancy\Jobs\RestoreTenantContext;
use App\Domain\Shared\Tenancy\Jobs\TenantAware;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Site\Actions\NewsletterLifecycle;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

final class SendCampaign implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use TenantAware;

    public const BATCH = 200;

    public int $tries = 4;

    public int $uniqueFor = 900;

    public function __construct(public readonly string $campaignId)
    {
        $this->onQueue('notifications');
    }

    public function uniqueId(): string
    {
        return "{$this->tenantId}:{$this->campaignId}";
    }

    public function backoff(): array
    {
        return [60, 300, 900];
    }

    public function middleware(): array
    {
        return [new RestoreTenantContext];
    }

    public function handle(MessagingChannel $channel, ContactBook $contacts, AuditLogger $audit, TenantContext $context): void
    {
        $campaign = DB::table('mkt_campaigns as c')->leftJoin('iam_users as u', 'u.id', '=', 'c.owner_id')->leftJoin('mkt_templates as t', 't.id', '=', 'c.template_id')
            ->where('c.id', $this->campaignId)->first(['c.id', 'c.code', 'c.channel', 'c.status', 'c.subject', 'c.body', 'c.promo_code', 'u.name as owner', 't.code as template_code', 't.provider_template_id']);

        if ($campaign === null || $campaign->status !== 'enviando') {
            return;
        }

        $book = $contacts->all()->keyBy(fn (array $contact): string => "{$contact['type']}:{$contact['id']}");
        $agency = (string) $context->tenant()->getAttribute('commercial_name');
        $subdomain = (string) $context->tenant()->getAttribute('subdomain');
        $trips = DB::table('booking_reservations')->whereNull('deleted_at')->whereNotIn('status', ['cancelada', 'borrador'])->where('travel_from', '>=', now($context->timezone())->toDateString())
            ->groupBy('client_id')->selectRaw('client_id, min(travel_from) as next')->pluck('next', 'client_id');
        $pending = false;
        $tenantId = (string) $context->idOrFail();
        $metric = $campaign->channel === 'email' ? 'email_month' : 'whatsapp_month';
        $remaining = self::remaining($tenantId, (string) $context->tenant()->getAttribute('plan_id'), $metric);
        $sent = 0;
        $deferred = false;

        DB::table('mkt_campaign_recipients')->where('campaign_id', $campaign->id)->where('status', 'pendiente')->orderBy('id')
            ->chunkById(self::BATCH, function ($rows) use ($campaign, $book, $channel, $agency, $subdomain, $trips, &$pending, &$remaining, &$sent, &$deferred): bool {
                foreach ($rows as $row) {
                    $contact = $book->get("{$row->subject_type}:{$row->subject_id}");
                    $reason = $this->suppression($contact, $campaign->channel);

                    if ($reason !== null) {
                        $this->suppress($campaign->id, $row, $reason);

                        continue;
                    }

                    if ($remaining !== null && $remaining <= 0) {
                        $deferred = true;

                        return false;
                    }

                    $next = $row->subject_type === 'client' ? ($trips[$row->subject_id] ?? null) : null;
                    $variables = [
                        'nombre' => Str::before((string) $contact['name'], ' '),
                        'destino' => (string) $contact['dest'],
                        'asesor' => (string) $campaign->owner,
                        'codigo_promo' => (string) $campaign->promo_code,
                        'fecha_viaje' => $next ? Carbon::parse($next)->format('d/m/Y') : '',
                        'agencia' => $agency,
                        'enlace_baja' => NewsletterLifecycle::unsubscribeUrl($subdomain, NewsletterLifecycle::campaignToken((string) $row->id)),
                    ];
                    $email = $campaign->channel === 'email';

                    $result = $channel->send(new OutboundMessage(
                        channel: $campaign->channel,
                        to: (string) $row->address,
                        subject: $email && $campaign->subject !== null ? self::render((string) $campaign->subject, $variables) : $campaign->subject,
                        body: $email ? self::render((string) $campaign->body, $variables) : $campaign->body,
                        templateCode: $email ? null : (string) ($campaign->provider_template_id ?? $campaign->template_code),
                        variables: $variables,
                    ));

                    if (! $result->ok && $result->errorClass === 'transitorio') {
                        $pending = true;
                        DB::table('mkt_campaign_recipients')->where('id', $row->id)->update(['error' => mb_substr((string) $result->message, 0, 500), 'updated_at' => now()]);

                        continue;
                    }

                    DB::table('mkt_campaign_recipients')->where('id', $row->id)->update([
                        'status' => $result->ok ? 'enviado' : 'fallido',
                        'provider_message_id' => $result->externalId,
                        'error' => $result->ok ? null : mb_substr((string) $result->message, 0, 500),
                        'updated_at' => now(),
                    ]);

                    if ($result->ok) {
                        $sent++;
                        $remaining = $remaining === null ? null : $remaining - 1;
                    }
                }

                return true;
            });

        UsageMeter::record($tenantId, $metric, $sent);

        if ($deferred) {
            $resume = Carbon::now($context->timezone())->startOfMonth()->addMonth()->setTime(8, 0);
            dispatch((new ResumeCampaign((string) $campaign->id))->forTenant($tenantId))->delay($resume);
            $audit->log('Campaña', $campaign->code, 'envio_diferido', 'enviando', 'Límite del plan alcanzado (SUB-BR-04): el resto se envía el '.$resume->format('d/m/Y'));

            return;
        }

        if ($pending) {
            if ($this->attempts() >= $this->tries) {
                throw new RuntimeException("Envíos pendientes por error transitorio en la campaña {$campaign->code}.");
            }

            $this->release($this->backoff()[min($this->attempts(), 2)]);

            return;
        }

        $totals = DB::table('mkt_campaign_recipients')->where('campaign_id', $campaign->id)->selectRaw("count(*) filter (where status = 'enviado') as sent, count(*) filter (where status = 'fallido') as failed")->first();
        DB::table('mkt_campaigns')->where('id', $campaign->id)->update(['status' => 'enviada', 'completed_at' => now(), 'updated_at' => now()]);
        $audit->log('Campaña', $campaign->code, 'envio_completado', 'enviando', "{$totals->sent} enviados · {$totals->failed} fallidos");
    }

    private static function remaining(string $tenantId, string $planId, string $metric): ?int
    {
        $hard = DB::connection('pgsql_platform')->table('plan_limits')->where('plan_id', $planId)->where('metric', $metric)->value('hard');
        $limit = EffectiveLimits::limit($tenantId, $planId, $metric);

        return $limit === null || $hard === false ? null : max(0, $limit - UsageMeter::used($tenantId, $metric));
    }

    public static function render(string $text, array $variables): string
    {
        return (string) preg_replace_callback('/\{\{\s*([a-z_]+)\s*\}\}/', fn (array $match): string => array_key_exists($match[1], $variables) ? (string) $variables[$match[1]] : $match[0], $text);
    }

    private function suppression(?array $contact, string $channel): ?string
    {
        return match (true) {
            $contact === null => 'nodata',
            $contact['revoked'][$channel] ?? false => 'optout',
            empty($contact[$channel === 'email' ? 'email' : 'mobile']) => 'nodata',
            ! $contact['consent'][$channel] => 'consent',
            default => null,
        };
    }

    private function suppress(string $campaignId, object $row, string $reason): void
    {
        DB::table('mkt_campaign_recipients')->where('id', $row->id)->delete();
        DB::table('mkt_campaign_suppressions')->insert(['id' => (string) Str::uuid7(), 'campaign_id' => $campaignId, 'subject_type' => $row->subject_type, 'subject_id' => $row->subject_id, 'reason' => $reason, 'created_at' => now()]);
    }
}
