<?php

declare(strict_types=1);

namespace App\Domain\Landing\Actions;

use App\Domain\Landing\Support\Visitor;
use App\Domain\Platform\Actions\PlatformSession;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Mail\QueuedMail;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class LandingNewsletter
{
    public const SOURCES = ['pie' => 'Pie de página', 'blog' => 'Blog', 'scroll_60' => '60 % del artículo', 'popup_salida' => 'Popup al salir', 'chatbot' => 'Chatbot'];

    public const STATUSES = ['pendiente' => 'Por confirmar', 'confirmado' => 'Confirmado', 'baja' => 'De baja'];

    public const CONSENT = 'Acepto recibir el boletín de KipuControl y el tratamiento de mi correo según la política de privacidad (Ley 29733). Puedo darme de baja en cualquier momento.';

    public const RESEND_MINUTES = 10;

    public function __construct(private readonly QueuedMail $mail, private readonly PlatformSession $session) {}

    public function subscribe(string $email, string $source, Request $request): array
    {
        $email = mb_strtolower(trim($email));
        $hash = Visitor::stableHash($email);
        $token = Str::random(48);

        $outcome = $this->db()->transaction(function () use ($email, $hash, $source, $token, $request): string {
            $row = $this->db()->table('platform_newsletter_subscribers')->where('site', 'kipucontrol')->where('email_hash', $hash)->lock('for no key update')->first();

            if ($row !== null && $row->status === 'confirmado') {
                return 'confirmado';
            }

            if ($row !== null && $row->status === 'pendiente' && $row->confirmation_sent_at !== null && Carbon::parse($row->confirmation_sent_at)->gt(now()->subMinutes(self::RESEND_MINUTES))) {
                return 'reciente';
            }

            $values = ['email' => Crypt::encryptString($email), 'source' => $source, 'status' => 'pendiente', 'token_hash' => hash('sha256', $token), 'consent_text' => self::CONSENT, 'ip_hash' => Visitor::ipHash($request), 'confirmation_sent_at' => now(), 'confirmed_at' => null, 'unsubscribed_at' => null, 'updated_at' => now()];

            if ($row === null) {
                $this->db()->table('platform_newsletter_subscribers')->insert(['id' => (string) Str::uuid7(), 'site' => 'kipucontrol', 'email_hash' => $hash, ...$values, 'created_at' => now()]);
            } else {
                $this->db()->table('platform_newsletter_subscribers')->where('id', $row->id)->update($values);
            }

            return 'enviado';
        });

        if ($outcome === 'enviado') {
            $this->mail->send($email, $email, 'Confirma tu suscripción al boletín de KipuControl', "Hola:\n\nRecibimos tu pedido para recibir el boletín de KipuControl: ventas, SUNAT, operación e IA para agencias de viaje, una vez al mes.\n\nConfirma tu correo en este enlace:\n{$this->link('confirmar', $token)}\n\nSi no fuiste tú, ignora este mensaje y no te escribiremos.\n\nPara darte de baja en cualquier momento:\n{$this->link('baja', $token)}\n\nKipuControl");
        }

        return ['status' => $outcome === 'confirmado' ? 'confirmado' : 'pendiente', 'message' => $outcome === 'confirmado' ? 'Ese correo ya recibe el boletín.' : 'Listo, revisa tu correo para confirmar la suscripción.'];
    }

    public function confirm(string $token): array
    {
        return $this->db()->transaction(function () use ($token): array {
            $row = $this->byToken($token);

            if ($row->status === 'baja') {
                throw ApiException::conflict('NEWSLETTER_UNSUBSCRIBED', 'Ese correo se dio de baja. Suscríbete de nuevo desde la página para volver a recibir el boletín.');
            }

            if ($row->status === 'pendiente') {
                $this->db()->table('platform_newsletter_subscribers')->where('id', $row->id)->update(['status' => 'confirmado', 'confirmed_at' => now(), 'updated_at' => now()]);
            }

            return ['status' => 'confirmado', 'email' => $this->masked($row->email), 'message' => 'Tu suscripción está confirmada. Te escribiremos una vez al mes.'];
        });
    }

    public function unsubscribe(string $token): array
    {
        return $this->db()->transaction(function () use ($token): array {
            $row = $this->byToken($token);

            if ($row->status !== 'baja') {
                $this->db()->table('platform_newsletter_subscribers')->where('id', $row->id)->update(['status' => 'baja', 'unsubscribed_at' => now(), 'updated_at' => now()]);
                $this->session->log('Boletín landing', $this->masked($row->email), 'baja', self::STATUSES[$row->status] ?? $row->status, self::STATUSES['baja']);
            }

            return ['status' => 'baja', 'email' => $this->masked($row->email), 'message' => 'Te diste de baja del boletín. No volverás a recibirlo.'];
        });
    }

    public function list(?string $status): array
    {
        $rows = $this->db()->table('platform_newsletter_subscribers')->where('site', 'kipucontrol')->orderByDesc('created_at')->get();

        return [
            'items' => $rows->when($status !== null && isset(self::STATUSES[$status]), fn ($all) => $all->where('status', $status))->take(200)->map(fn (object $row): array => [
                'id' => (string) $row->id,
                'email' => $this->decrypt($row->email),
                'source' => $row->source,
                'source_label' => self::SOURCES[$row->source] ?? $row->source,
                'status' => $row->status,
                'status_label' => self::STATUSES[$row->status] ?? $row->status,
                'created_at' => Carbon::parse($row->created_at)->toIso8601String(),
                'confirmed_at' => $row->confirmed_at ? Carbon::parse($row->confirmed_at)->toIso8601String() : null,
                'unsubscribed_at' => $row->unsubscribed_at ? Carbon::parse($row->unsubscribed_at)->toIso8601String() : null,
            ])->values()->all(),
            'counts' => [
                'total' => $rows->count(),
                ...collect(array_keys(self::STATUSES))->mapWithKeys(fn (string $key): array => [$key => $rows->where('status', $key)->count()])->all(),
            ],
            'sources' => collect(self::SOURCES)->map(fn (string $label, string $key): array => ['value' => $key, 'label' => $label, 'confirmed' => $rows->where('source', $key)->where('status', 'confirmado')->count()])->values()->all(),
        ];
    }

    private function byToken(string $token): object
    {
        $row = strlen($token) >= 32 && strlen($token) <= 64 ? $this->db()->table('platform_newsletter_subscribers')->where('token_hash', hash('sha256', $token))->lock('for no key update')->first() : null;

        return $row ?? throw ApiException::notFound('El enlace no es válido o ya fue reemplazado por uno más reciente.');
    }

    private function link(string $action, string $token): string
    {
        return rtrim((string) config('app.frontend_url'), '/')."/software/boletin/{$action}/{$token}";
    }

    private function masked(string $encrypted): string
    {
        $email = $this->decrypt($encrypted);
        [$user, $domain] = array_pad(explode('@', $email, 2), 2, '');

        return mb_substr($user, 0, 2).str_repeat('•', max(1, mb_strlen($user) - 2)).'@'.$domain;
    }

    private function decrypt(string $value): string
    {
        try {
            return Crypt::decryptString($value);
        } catch (\Throwable) {
            return '—';
        }
    }

    private function db(): ConnectionInterface
    {
        return DB::connection('pgsql_platform');
    }
}
