<?php

declare(strict_types=1);

namespace App\Domain\Site\Actions;

use App\Domain\Marketing\Support\UnsubscribeConfirmation;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Request;
use Illuminate\Support\Str;
use stdClass;

final class NewsletterLifecycle
{
    private const CONTACT_TABLES = ['client' => 'crm_clients', 'lead' => 'crm_leads', 'subscriber' => 'mkt_contacts_subscribers'];

    public function __construct(private readonly TenantContext $context, private readonly AuditLogger $audit) {}

    public static function token(string $subscriberCode, string $email): string
    {
        return $subscriberCode.'.'.hash_hmac('sha256', 'newsletter|'.$subscriberCode.'|'.Str::lower($email), (string) config('app.key'));
    }

    public static function campaignToken(string $recipientId): string
    {
        return 'c'.$recipientId.'.'.hash_hmac('sha256', 'campaign|'.$recipientId, (string) config('app.key'));
    }

    public static function contactToken(string $type, string $id): string
    {
        return 'k'.$type.'-'.$id.'.'.hash_hmac('sha256', 'contact|'.$type.'|'.$id, (string) config('app.key'));
    }

    public static function unsubscribeUrl(string $subdomain, string $token): string
    {
        return rtrim((string) config('app.frontend_url'), '/').'/sitio/'.$subdomain.'/boletin/baja?token='.$token;
    }

    public function confirm(string $token): array
    {
        [$subscriber, $consent] = $this->resolve($token);
        $now = Carbon::now($this->context->timezone());

        if ($consent->status !== 'otorgado') {
            throw ApiException::conflict('SIT-BR-25', 'Diste de baja esta suscripción. Vuelve a suscribirte desde el sitio si quieres recibir novedades.');
        }

        if (! str_contains((string) $consent->source, 'confirmado')) {
            DB::table('mkt_consents')->where('id', $consent->id)->update(['source' => 'Newsletter del sitio web (doble opt-in confirmado)', 'evidence' => 'Enlace de confirmación abierto · '.$now->format('Y-m-d H:i')]);
            $this->event((string) $consent->id, 'otorgado', 'Confirmación del correo (doble opt-in)', $now);
            $this->audit->log('Suscriptor', (string) $subscriber->email, 'confirmar', after: 'doble opt-in');
        }

        return ['email' => $subscriber->email, 'status' => 'confirmado'];
    }

    public function unsubscribe(string $token): array
    {
        if (preg_match('/^c([0-9a-f-]{36})\./', $token, $match) === 1) {
            return $this->unsubscribeRecipient($match[1], $token);
        }

        if (preg_match('/^k(client|lead|subscriber)-([0-9a-f-]{36})\./', $token, $match) === 1) {
            return $this->unsubscribeContact($match[1], $match[2], $token);
        }

        [$subscriber, $consent] = $this->resolve($token);
        $now = Carbon::now($this->context->timezone());

        if ($consent->status !== 'revocado') {
            DB::table('mkt_consents')->where('id', $consent->id)->update(['status' => 'revocado', 'revoked_at' => $now, 'revoke_source' => 'Enlace de baja del boletín']);
            $this->event((string) $consent->id, 'revocado', 'Enlace de baja del boletín', $now);
            $this->audit->log('Suscriptor', (string) $subscriber->email, 'baja', 'otorgado', 'revocado');
            app(UnsubscribeConfirmation::class)->send('subscriber', (string) $subscriber->id, 'email', (string) $consent->id);
        }

        return ['email' => $subscriber->email, 'status' => 'baja'];
    }

    private function unsubscribeRecipient(string $recipientId, string $token): array
    {
        $recipient = DB::table('mkt_campaign_recipients as r')->join('mkt_campaigns as c', 'c.id', '=', 'r.campaign_id')->where('r.id', $recipientId)
            ->first(['r.id', 'r.campaign_id', 'r.subject_type', 'r.subject_id', 'r.address', 'r.unsubscribed_at', 'c.code as campaign']);

        if (! $recipient instanceof stdClass || ! hash_equals(self::campaignToken($recipientId), $token)) {
            throw ApiException::notFound('El enlace no es válido.');
        }

        $now = Carbon::now($this->context->timezone());

        DB::transaction(function () use ($recipient, $now): void {
            $this->revokeEmail((string) $recipient->subject_type, (string) $recipient->subject_id, "Enlace de baja de la campaña {$recipient->campaign}", $now, (string) $recipient->campaign_id);

            if ($recipient->unsubscribed_at === null) {
                DB::table('mkt_campaign_recipients')->where('id', $recipient->id)->update(['unsubscribed_at' => $now, 'updated_at' => $now]);
            }
        });

        return ['email' => $recipient->address, 'status' => 'baja'];
    }

    private function unsubscribeContact(string $type, string $id, string $token): array
    {
        $table = self::CONTACT_TABLES[$type];
        $email = DB::table($table)->where('id', $id)->value('email');

        if ($email === null || ! hash_equals(self::contactToken($type, $id), $token)) {
            throw ApiException::notFound('El enlace no es válido.');
        }

        DB::transaction(fn () => $this->revokeEmail($type, $id, 'Enlace de baja de un mensaje automático', Carbon::now($this->context->timezone())));

        return ['email' => $email, 'status' => 'baja'];
    }

    private function revokeEmail(string $type, string $id, string $source, Carbon $now, ?string $campaignId = null): void
    {
        $consent = DB::table('mkt_consents')->where('subject_type', $type)->where('subject_id', $id)->where('channel', 'email')->lockForUpdate()->first(['id', 'code', 'status']);

        if ($consent === null || $consent->status === 'revocado') {
            return;
        }

        DB::table('mkt_consents')->where('id', $consent->id)->update(['status' => 'revocado', 'revoked_at' => $now, 'revoke_source' => $source, 'revoke_campaign_id' => $campaignId, 'lock_version' => DB::raw('lock_version + 1'), 'updated_at' => $now]);
        $this->event((string) $consent->id, 'revocado', $source, $now);
        $this->audit->log('Consentimiento', (string) $consent->code, 'baja_email', 'otorgado', "revocado · {$source}");
        app(UnsubscribeConfirmation::class)->send($type, $id, 'email', (string) $consent->id);
    }

    private function resolve(string $token): array
    {
        $code = Str::before($token, '.');
        $subscriber = DB::table('mkt_contacts_subscribers')->where('code', $code)->whereNull('deleted_at')->first(['id', 'code', 'email']);

        if (! $subscriber instanceof stdClass || ! hash_equals(self::token((string) $subscriber->code, (string) $subscriber->email), $token)) {
            throw ApiException::notFound('El enlace no es válido.');
        }

        $consent = DB::table('mkt_consents')->where('subject_type', 'subscriber')->where('subject_id', $subscriber->id)->where('channel', 'email')->first(['id', 'status', 'source']);

        return [$subscriber, $consent ?? throw ApiException::notFound('El enlace no es válido.')];
    }

    private function event(string $consentId, string $event, string $source, Carbon $at): void
    {
        DB::table('mkt_consent_events')->insert([
            'id' => (string) Str::uuid7(),
            'tenant_id' => $this->context->idOrFail(),
            'consent_id' => $consentId,
            'event' => $event,
            'source' => $source,
            'evidence' => $source.' · '.$at->format('Y-m-d H:i'),
            'occurred_at' => $at,
            'ip' => Request::ip(),
        ]);
    }
}
