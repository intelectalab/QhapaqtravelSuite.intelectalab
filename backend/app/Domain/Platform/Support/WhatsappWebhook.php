<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;

final class WhatsappWebhook
{
    public const KEY = 'whatsapp_webhook';

    public const PATH = '/api/v1/integrations/whatsapp/webhook';

    public function raw(): array
    {
        return PlatformSettings::read(self::KEY);
    }

    public function verifyToken(): string
    {
        $encrypted = (string) ($this->raw()['verify_token'] ?? '');

        if ($encrypted === '') {
            return '';
        }

        try {
            return Crypt::decryptString($encrypted);
        } catch (DecryptException) {
            return '';
        }
    }

    public function matches(string $candidate): bool
    {
        $token = $this->verifyToken();

        return $token !== '' && $candidate !== '' && hash_equals($token, $candidate);
    }

    public function summary(): array
    {
        $raw = $this->raw();

        return [
            'verify_token_set' => $this->verifyToken() !== '',
            'callback_url' => rtrim((string) config('app.url'), '/').self::PATH,
            'changed_at' => $raw['changed_at'] ?? null,
        ];
    }

    public function store(?string $token, string $actorId): void
    {
        PlatformSettings::write(self::KEY, [
            'verify_token' => $token === null ? '' : Crypt::encryptString($token),
            'changed_at' => now()->toIso8601String(),
        ], $actorId);
    }
}
