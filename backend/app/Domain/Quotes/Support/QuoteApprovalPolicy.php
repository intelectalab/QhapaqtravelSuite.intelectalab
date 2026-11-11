<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Support;

use App\Domain\Admin\Support\TenantSettings;

final class QuoteApprovalPolicy
{
    public const DEFAULTS = ['discount_limit' => '5', 'margin_floor' => '15', 'max_discount' => '10'];

    public function __construct(private readonly TenantSettings $settings) {}

    public function limits(): array
    {
        $policies = $this->settings->section('policies');

        return [
            'discount_limit' => (string) ($policies['max_discount_pct'] ?? self::DEFAULTS['discount_limit']),
            'margin_floor' => (string) ($policies['approval_margin_pct'] ?? self::DEFAULTS['margin_floor']),
            'max_discount' => (string) ($policies['discount_cap_pct'] ?? self::DEFAULTS['max_discount']),
        ];
    }
}
