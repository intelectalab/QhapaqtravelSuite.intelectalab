<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Data;

final readonly class PaymentWebhook
{
    public function __construct(
        public string $raw,
        public array $headers = [],
        public array $query = [],
        public array $form = [],
    ) {}

    public function header(string $name): string
    {
        $value = $this->headers[strtolower($name)] ?? '';

        return is_array($value) ? (string) ($value[0] ?? '') : (string) $value;
    }

    public function json(): array
    {
        $data = json_decode($this->raw, true);

        return is_array($data) ? $data : [];
    }
}
