<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Integrations\Contracts\MessagingChannel;
use App\Domain\Integrations\Data\OutboundMessage;
use App\Domain\Marketing\Support\ContactBook;
use App\Domain\Platform\Support\UsageMeter;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Tenancy\Jobs\RestoreTenantContext;
use App\Domain\Shared\Tenancy\Jobs\TenantAware;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Site\Actions\NewsletterLifecycle;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class SendAutomationMessages implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use TenantAware;

    public int $tries = 3;

    public function __construct(public readonly string $automationCode, public readonly array $recipients)
    {
        $this->onQueue('notifications');
    }

    public function backoff(): array
    {
        return [60, 300];
    }

    public function middleware(): array
    {
        return [new RestoreTenantContext];
    }

    public function handle(MessagingChannel $channel, ContactBook $contacts, AuditLogger $audit, TenantContext $context): void
    {
        $automation = DB::table('mkt_automations as a')->leftJoin('mkt_templates as t', 't.id', '=', 'a.template_id')->where('a.code', $this->automationCode)
            ->first(['a.code', 'a.channel', 't.code as template_code', 't.provider_template_id', 't.subject', 't.body']);

        if ($automation === null || $this->recipients === []) {
            return;
        }

        $book = $contacts->all()->keyBy(fn (array $contact): string => "{$contact['type']}:{$contact['id']}");
        $subdomain = (string) $context->tenant()->getAttribute('subdomain');
        $agency = (string) $context->tenant()->getAttribute('commercial_name');
        $email = $automation->channel === 'email';
        $sent = 0;
        $failed = 0;

        foreach ($this->recipients as $recipient) {
            $contact = $book->get("{$recipient['subject_type']}:{$recipient['subject_id']}");

            if ($contact === null || ($contact['revoked'][$automation->channel] ?? false) || empty($recipient['address'])) {
                $failed++;

                continue;
            }

            $travel = $recipient['ref_type'] === 'reservation' ? DB::table('booking_reservations')->where('id', $recipient['ref_id'])->value('travel_from') : null;
            $variables = [
                'nombre' => Str::before((string) $contact['name'], ' '),
                'destino' => (string) $contact['dest'],
                'agencia' => $agency,
                'asesor' => '',
                'codigo_promo' => '',
                'fecha_viaje' => $travel !== null ? Carbon::parse($travel)->format('d/m/Y') : '',
                'enlace_baja' => NewsletterLifecycle::unsubscribeUrl($subdomain, NewsletterLifecycle::contactToken((string) $contact['type'], (string) $contact['id'])),
            ];

            $result = $channel->send(new OutboundMessage(
                channel: (string) $automation->channel,
                to: (string) $recipient['address'],
                subject: $email ? SendCampaign::render((string) $automation->subject, $variables) : null,
                body: $email ? SendCampaign::render((string) $automation->body, $variables) : null,
                templateCode: $email ? null : (string) ($automation->provider_template_id ?? $automation->template_code),
                variables: $variables,
            ));

            $result->ok ? $sent++ : $failed++;
        }

        UsageMeter::record((string) $context->idOrFail(), $email ? 'email_month' : 'whatsapp_month', $sent);
        $audit->log('Automatización', (string) $automation->code, 'envio_completado', count($this->recipients).' en cola', "{$sent} entregados · {$failed} sin entregar");
    }
}
