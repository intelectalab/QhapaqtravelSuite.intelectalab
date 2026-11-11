<?php

declare(strict_types=1);

namespace App\Domain\Site\Actions;

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
    public function __construct(private readonly TenantContext $context, private readonly AuditLogger $audit) {}

    public static function token(string $subscriberCode, string $email): string
    {
        return $subscriberCode.'.'.hash_hmac('sha256', 'newsletter|'.$subscriberCode.'|'.Str::lower($email), (string) config('app.key'));
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
        [$subscriber, $consent] = $this->resolve($token);
        $now = Carbon::now($this->context->timezone());

        if ($consent->status !== 'revocado') {
            DB::table('mkt_consents')->where('id', $consent->id)->update(['status' => 'revocado', 'revoked_at' => $now, 'revoke_source' => 'Enlace de baja del boletín']);
            $this->event((string) $consent->id, 'revocado', 'Enlace de baja del boletín', $now);
            $this->audit->log('Suscriptor', (string) $subscriber->email, 'baja', 'otorgado', 'revocado');
        }

        return ['email' => $subscriber->email, 'status' => 'baja'];
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
