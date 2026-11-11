<?php

declare(strict_types=1);

namespace App\Domain\Site\Actions;

use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Mail\QueuedMail;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Request;
use Illuminate\Support\Str;

final class SubscribeNewsletter
{
    private const SOURCE = 'Newsletter web';

    public function __construct(
        private readonly TenantContext $context,
        private readonly CodeSequence $codes,
        private readonly AuditLogger $audit,
    ) {}

    public function handle(string $email, ?string $name): array
    {
        $now = Carbon::now($this->context->timezone());
        $email = Str::lower(trim($email));
        $subscriber = DB::table('mkt_contacts_subscribers')->where('email', $email)->first(['id', 'code', 'deleted_at']);
        $consent = $subscriber ? DB::table('mkt_consents')->where('subject_type', 'subscriber')->where('subject_id', $subscriber->id)->where('channel', 'email')->first(['id', 'status']) : null;

        if ($subscriber && $subscriber->deleted_at === null && $consent?->status === 'otorgado') {
            return ['status' => 'existente'];
        }

        $subscriberId = $subscriber->id ?? (string) Str::uuid7();

        if ($subscriber === null) {
            DB::table('mkt_contacts_subscribers')->insert([
                'id' => $subscriberId,
                'tenant_id' => $this->context->idOrFail(),
                'code' => $this->codes->next('mkt_contacts_subscribers', 'SUB-'),
                'full_name' => $name ? trim($name) : Str::before($email, '@'),
                'email' => $email,
                'source' => self::SOURCE,
                'client_id' => DB::table('crm_clients')->whereNull('deleted_at')->where('email_norm', $email)->value('id'),
            ]);
        } else {
            DB::table('mkt_contacts_subscribers')->where('id', $subscriberId)->update(['deleted_at' => null, 'updated_at' => $now]);
        }

        $evidence = 'Casilla marcada en el sitio web · '.$now->format('Y-m-d H:i');
        $consentId = $consent->id ?? (string) Str::uuid7();

        if ($consent === null) {
            DB::table('mkt_consents')->insert([
                'id' => $consentId,
                'tenant_id' => $this->context->idOrFail(),
                'code' => $this->codes->next('mkt_consents', 'CNS-'),
                'subject_type' => 'subscriber',
                'subject_id' => $subscriberId,
                'channel' => 'email',
                'status' => 'otorgado',
                'granted_at' => $now,
                'source' => 'Newsletter del sitio web (doble opt-in pendiente)',
                'evidence' => $evidence,
                'policy_version' => CaptureWebLead::POLICY_VERSION,
            ]);
        } else {
            DB::table('mkt_consents')->where('id', $consentId)->update(['status' => 'otorgado', 'granted_at' => $now, 'revoked_at' => null, 'revoke_source' => null, 'evidence' => $evidence, 'policy_version' => CaptureWebLead::POLICY_VERSION]);
        }

        DB::table('mkt_consent_events')->insert([
            'id' => (string) Str::uuid7(),
            'tenant_id' => $this->context->idOrFail(),
            'consent_id' => $consentId,
            'event' => 'otorgado',
            'source' => 'Newsletter del sitio web',
            'evidence' => $evidence,
            'occurred_at' => $now,
            'ip' => Request::ip(),
        ]);
        $this->audit->log('Suscriptor', $email, $subscriber ? 'reactivar' : 'crear', after: 'otorgado');
        $this->sendConfirmation((string) DB::table('mkt_contacts_subscribers')->where('id', $subscriberId)->value('code'), $email, $name);

        return ['status' => $subscriber ? 'reactivado' : 'creado'];
    }

    private function sendConfirmation(string $code, string $email, ?string $name): void
    {
        $tenant = $this->context->tenant();
        $token = NewsletterLifecycle::token($code, $email);
        $base = rtrim((string) config('app.frontend_url'), '/').'/sitio/'.$tenant->subdomain.'/boletin';
        $body = 'Hola'.($name ? " {$name}" : '').":\n\nConfirma que quieres recibir ofertas y novedades de {$tenant->commercial_name}:\n{$base}/confirmar?token={$token}\n\nSi no fuiste tú, ignora este correo. Puedes darte de baja cuando quieras:\n{$base}/baja?token={$token}";

        app(QueuedMail::class)->send($email, $name, "Confirma tu suscripción · {$tenant->commercial_name}", $body);
    }
}
