<?php

declare(strict_types=1);

namespace App\Domain\Platform\Actions;

use App\Domain\Integrations\Mail\SmtpConnector;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Support\OutgoingMail;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Throwable;

final class UpdateOutgoingMail
{
    private const LABELS = [
        'enabled' => 'Correo de salida',
        'host' => 'Servidor de salida',
        'port' => 'Puerto de salida',
        'encryption' => 'Cifrado del correo',
        'username' => 'Usuario del correo',
        'from_address' => 'Remitente',
        'from_name' => 'Nombre del remitente',
    ];

    private const CONNECTION_FIELDS = ['host', 'port', 'encryption', 'username'];

    public function __construct(
        private readonly OutgoingMail $settings,
        private readonly SmtpConnector $smtp,
        private readonly PlatformSession $session,
    ) {}

    public function update(array $data, ?string $password, PlatformUser $actor): array
    {
        $password = $password === null || $password === '' ? null : $password;
        $values = [
            'enabled' => (bool) $data['enabled'],
            'host' => mb_strtolower(trim((string) ($data['host'] ?? ''))),
            'port' => isset($data['port']) && $data['port'] !== '' ? (int) $data['port'] : null,
            'encryption' => (string) ($data['encryption'] ?? 'ssl'),
            'username' => trim((string) ($data['username'] ?? '')),
            'from_address' => mb_strtolower(trim((string) ($data['from_address'] ?? ''))),
            'from_name' => trim((string) ($data['from_name'] ?? '')),
        ];
        $before = $this->settings->summary();
        $effective = $password ?? $this->settings->password();

        if ($values['enabled'] && ! $this->settings->complete($values, $effective)) {
            throw ApiException::unprocessable('CFG-MAIL-01', 'Para activarlo necesitas el servidor, el puerto, el usuario, la contraseña y el remitente.');
        }

        $changes = [];
        foreach (self::LABELS as $field => $label) {
            $old = $before[$field];
            $new = $values[$field];
            if ($old !== $new && ! ($old === '' && $new === null)) {
                $changes[$label] = [$this->text($field, $old), $this->text($field, $new)];
            }
        }
        if ($password !== null && $password !== $this->settings->password()) {
            $changes['Contraseña del correo'] = [$before['password_set'] ? 'configurada' : null, 'cambiada'];
        }

        if ($changes === []) {
            throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
        }

        $connectionChanged = $password !== null || array_filter(self::CONNECTION_FIELDS, fn (string $field): bool => $before[$field] !== $values[$field]) !== [];
        $verifiedAt = null;
        if ($values['enabled'] && ($connectionChanged || ! $before['enabled'])) {
            $problem = $this->smtp->problem($this->settings->connectionFrom($values, $effective));
            if ($problem !== null) {
                throw ApiException::unprocessable('CFG-MAIL-02', $problem);
            }
            $verifiedAt = now()->toIso8601String();
        }

        DB::connection('pgsql_platform')->transaction(function () use ($values, $password, $verifiedAt, $actor, $changes): void {
            $this->settings->store($values, $password, $verifiedAt, (string) $actor->getKey());
            foreach ($changes as $field => [$old, $new]) {
                $this->session->log(UpdatePlatformSettings::ENTITY, $field, 'actualizar', $old, $new, $actor);
            }
        });

        return $this->settings->summary();
    }

    public function sendTest(string $to, PlatformUser $actor): array
    {
        $connection = $this->settings->connection()
            ?? throw ApiException::unprocessable('CFG-MAIL-03', 'Activa y guarda el correo de salida antes de enviar una prueba.');

        $email = (new Email)
            ->from(new Address($connection['from_address'], $connection['from_name']))
            ->to($to)
            ->subject('Correo de prueba de la plataforma')
            ->text("Este es un correo de prueba enviado desde Configuración de la consola.\n\nSi lo recibiste, los avisos, invitaciones y documentos de la plataforma ya salen desde {$connection['from_address']}.");

        try {
            $this->smtp->make($connection)->send($email);
        } catch (Throwable $exception) {
            report($exception);
            $this->settings->recordTest($to, false, (string) $actor->getKey());
            $this->session->log(UpdatePlatformSettings::ENTITY, 'Correo de prueba', 'probar', null, "fallido a {$to}", $actor);

            throw ApiException::unprocessable('CFG-MAIL-02', $this->smtp->explain($exception, $connection));
        }

        $this->settings->recordTest($to, true, (string) $actor->getKey());
        $this->session->log(UpdatePlatformSettings::ENTITY, 'Correo de prueba', 'probar', null, "enviado a {$to}", $actor);

        return $this->settings->summary();
    }

    private function text(string $field, mixed $value): ?string
    {
        return match (true) {
            $field === 'enabled' => $value ? 'activo' : 'apagado',
            $value === null || $value === '' => null,
            $field === 'encryption' => ['ssl' => 'SSL', 'tls' => 'STARTTLS', 'none' => 'sin cifrado'][$value] ?? (string) $value,
            default => (string) $value,
        };
    }
}
