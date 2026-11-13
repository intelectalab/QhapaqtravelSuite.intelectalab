<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Support;

use App\Domain\Shared\Errors\ApiException;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

final class ChannelWebhooks
{
    public const SIGNATURE_HEADER = 'X-Hub-Signature-256';

    public const CHANNELS = ['whatsapp', 'email'];

    public function account(string $channel, ?string $phoneNumberId, ?string $mailbox): object
    {
        if (! in_array($channel, self::CHANNELS, true) || (blank($phoneNumberId) && blank($mailbox))) {
            throw ApiException::notFound('No hay una cuenta de canal conectada para este evento.');
        }

        $account = DB::connection('pgsql_platform')->selectOne(
            'select tenant_id, account_id from app_resolve_channel_account(?, ?, ?)',
            [$channel, blank($phoneNumberId) ? null : $phoneNumberId, blank($mailbox) ? null : $mailbox],
        );

        if ($account === null) {
            throw ApiException::notFound('No hay una cuenta de canal conectada para este evento.');
        }

        return $account;
    }

    public function verify(string $accountId, string $raw, string $signature): void
    {
        $stored = DB::table('collab_channel_accounts')->where('id', $accountId)->value('webhook_secret_encrypted');

        try {
            $secret = $stored ? Crypt::decryptString((string) $stored) : '';
        } catch (DecryptException) {
            $secret = '';
        }

        if ($secret === '' || $signature === '' || ! hash_equals(self::sign($raw, $secret), $this->normalize($signature))) {
            throw ApiException::unauthorized('WEBHOOK_SIGNATURE_INVALID', 'La firma del proveedor no es válida.');
        }
    }

    public static function sign(string $raw, string $secret): string
    {
        return 'sha256='.hash_hmac('sha256', $raw, $secret);
    }

    private function normalize(string $signature): string
    {
        return str_starts_with($signature, 'sha256=') ? $signature : 'sha256='.$signature;
    }
}
