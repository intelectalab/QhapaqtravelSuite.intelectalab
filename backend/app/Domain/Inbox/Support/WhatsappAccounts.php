<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Support;

use App\Domain\Platform\Support\IntegrationSecrets;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

final class WhatsappAccounts
{
    public const MODES = ['plataforma' => 'Registro guiado de KipuControl', 'propia' => 'App de Meta propia'];

    public static function hash(string $wabaId): string
    {
        return hash('sha256', 'waba:'.trim($wabaId));
    }

    public static function mask(?string $value): ?string
    {
        $value = trim((string) $value);

        return $value === '' ? null : str_repeat('•', max(4, strlen($value) - 4)).substr($value, -4);
    }

    public function account(): ?object
    {
        return DB::table('collab_channel_accounts')->where('channel', 'whatsapp')->orderBy('created_at')->first();
    }

    public function connected(?object $account = null): ?object
    {
        $account ??= $this->account();

        return $account !== null && $account->status === 'activo' && filled($account->phone_number_id) && filled($account->connected_at ?? null) ? $account : null;
    }

    public function credentials(?object $account): array
    {
        return $account === null ? [] : IntegrationSecrets::open($account->credentials_encrypted ?? null);
    }

    public function waba(?object $account): ?string
    {
        if ($account === null || blank($account->waba_id_encrypted ?? null)) {
            return null;
        }

        try {
            return Crypt::decryptString((string) $account->waba_id_encrypted);
        } catch (DecryptException) {
            return null;
        }
    }

    public function sender(?object $account = null): ?array
    {
        $account = $this->connected($account);

        if ($account === null) {
            return null;
        }

        return [
            'account_id' => (string) $account->id,
            'phone_number_id' => (string) $account->phone_number_id,
            'access_token' => (string) ($this->credentials($account)['access_token'] ?? ''),
            'mode' => (string) ($account->connection_mode ?? 'plataforma'),
        ];
    }
}
