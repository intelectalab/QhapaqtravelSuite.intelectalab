<?php

declare(strict_types=1);

namespace App\Domain\Admin\Actions;

use App\Domain\Iam\Models\User;
use App\Domain\Integrations\Mail\AgencyMailbox;
use App\Domain\Integrations\Mail\AgencyMailer;
use App\Domain\Integrations\Mail\SmtpConnector;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Throwable;

final class ManageAgencyMail
{
    public function __construct(
        private readonly AgencyMailbox $mailbox,
        private readonly SmtpConnector $smtp,
        private readonly AgencyMailer $mailer,
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
    ) {}

    public function connect(array $input, User $actor): array
    {
        $data = Validator::make($input, [
            'provider' => ['required', Rule::in(array_keys(AgencyMailbox::PROVIDERS))],
            'address' => ['required', 'email:rfc', 'max:150'],
            'password' => ['nullable', 'string', 'max:200'],
            'from_name' => ['nullable', 'string', 'max:120'],
            'host' => ['exclude_unless:provider,otro', 'required', 'string', 'max:150', 'regex:/^[A-Za-z0-9.-]+$/'],
            'port' => ['exclude_unless:provider,otro', 'required', 'integer', Rule::in([25, 465, 587, 2525])],
            'encryption' => ['exclude_unless:provider,otro', 'required', Rule::in(['ssl', 'tls', 'none'])],
        ], [
            'provider.*' => 'Elige dónde está tu correo.',
            'address.*' => 'Escribe el correo desde el que vas a enviar.',
            'password.*' => 'La clave de aplicación admite hasta 200 caracteres.',
            'from_name.*' => 'El nombre del remitente admite hasta 120 caracteres.',
            'host.*' => 'Escribe el servidor SMTP de tu correo.',
            'port.*' => 'Elige el puerto: 465, 587, 25 o 2525.',
            'encryption.*' => 'Elige el cifrado de la conexión.',
        ])->validate();

        $before = $this->mailbox->raw();
        $password = trim((string) ($data['password'] ?? ''));
        $samePassword = $password === '' && mb_strtolower((string) ($before['address'] ?? '')) === mb_strtolower((string) $data['address']);
        $password = $samePassword ? $this->mailbox->password($before) : $password;

        if ($password === '') {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'Escribe la clave de aplicación de tu correo.', ['field' => 'password']);
        }

        $connection = $this->mailbox->connectionFrom($data, $password) ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'Completa los datos del servidor de correo.', ['field' => 'host']);
        $problem = $this->smtp->problem($connection);

        if ($problem === null) {
            try {
                $agency = (string) $this->context->tenant()->commercial_name;
                $this->mailer->deliver($connection, $connection['from_address'], $connection['from_name'] ?: $agency, 'Tu correo quedó conectado a KipuControl', "Hola:\n\nEste es un correo de prueba. Desde ahora, las cotizaciones, vouchers y avisos que {$agency} envía a sus clientes salen desde esta cuenta.\n\nKipuControl");
            } catch (Throwable $exception) {
                report($exception);
                $problem = $this->smtp->explain($exception, $connection);
            }
        }

        if ($problem !== null) {
            $this->audit->log('Integración', 'correo-de-salida', 'probar_conexion', null, 'error · '.$problem);

            throw ApiException::unprocessable('MAIL-TEST-FAILED', $problem, ['field' => 'password']);
        }

        $this->mailbox->store($data, $password, $actor);
        $this->audit->log('Integración', 'correo-de-salida', 'conectar', ($before['address'] ?? null) ? (string) $before['address'] : null, AgencyMailbox::PROVIDERS[$data['provider']]['label'].' · '.mb_strtolower((string) $data['address']));

        return $this->mailbox->summary();
    }

    public function disconnect(User $actor): array
    {
        $before = $this->mailbox->raw();

        if (($before['address'] ?? '') === '') {
            throw ApiException::unprocessable('CFG-BR-01', 'La agencia todavía no tiene un correo conectado.');
        }

        $this->mailbox->forget($actor);
        $this->audit->log('Integración', 'correo-de-salida', 'desconectar', (string) $before['address'], null);

        return $this->mailbox->summary();
    }
}
