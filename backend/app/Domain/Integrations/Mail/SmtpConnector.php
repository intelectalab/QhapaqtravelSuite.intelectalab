<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Mail;

use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Symfony\Component\Mailer\Transport\Smtp\EsmtpTransport;
use Symfony\Component\Mailer\Transport\TransportInterface;
use Throwable;

class SmtpConnector
{
    public const TIMEOUT_SECONDS = 15;

    public function make(array $connection): TransportInterface
    {
        $transport = new EsmtpTransport($connection['host'], $connection['port'], $connection['encryption'] === 'ssl');

        if ($connection['encryption'] === 'none') {
            $transport->setAutoTls(false);
        }

        if ($connection['encryption'] === 'tls') {
            $transport->setRequireTls(true);
        }

        $stream = $transport->getStream();
        if (method_exists($stream, 'setTimeout')) {
            $stream->setTimeout(self::TIMEOUT_SECONDS);
        }

        return $transport->setUsername($connection['username'])->setPassword($connection['password']);
    }

    public function problem(array $connection): ?string
    {
        $transport = $this->make($connection);

        try {
            if ($transport instanceof EsmtpTransport) {
                $transport->start();
                $transport->stop();
            }

            return null;
        } catch (Throwable $exception) {
            report($exception);

            return $this->explain($exception, $connection);
        }
    }

    public function explain(Throwable $exception, array $connection): string
    {
        $text = mb_strtolower($exception->getMessage());

        return match (true) {
            $exception instanceof TransportExceptionInterface && (str_contains($text, '535') || str_contains($text, 'authenticat') || str_contains($text, 'credentials')) => 'El servidor de correo rechazó el usuario o la contraseña.',
            str_contains($text, 'certificate') || str_contains($text, 'ssl') || str_contains($text, 'tls') => "No pudimos abrir una conexión segura con {$connection['host']}. Revisa el cifrado y el puerto.",
            default => "No pudimos conectarnos a {$connection['host']}:{$connection['port']}. Revisa el servidor, el puerto y el cifrado.",
        };
    }
}
