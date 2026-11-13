<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Support;

use App\Domain\Platform\Support\OutgoingMail;
use App\Domain\Shared\Errors\ApiException;

final class ProviderSignature
{
    public const HEADER = 'X-Signature';

    public function __construct(private readonly OutgoingMail $settings) {}

    public function verify(string $provider, string $raw, string $signature): void
    {
        $secret = $this->settings->webhookSecret($provider);
        $signature = str_starts_with($signature, 'sha256=') ? $signature : 'sha256='.$signature;

        if ($secret === '' || $signature === 'sha256=' || ! hash_equals(ChannelWebhooks::sign($raw, $secret), $signature)) {
            throw ApiException::unauthorized('WEBHOOK_SIGNATURE_INVALID', 'La firma del proveedor no es válida.');
        }
    }
}
