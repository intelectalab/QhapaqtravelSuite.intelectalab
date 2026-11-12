<?php

declare(strict_types=1);

namespace App\Domain\Site\Support;

use App\Domain\Booking\Rules\RuleResolver;
use Illuminate\Support\Facades\DB;

final class SiteAltitude
{
    public const DEFAULT_MIN = 3500;

    private array $cache = [];

    public function __construct(private readonly RuleResolver $rules) {}

    public function threshold(): ?int
    {
        return $this->rules->on('R-ALTITUDE') ? (int) ($this->rules->param('R-ALTITUDE', 'minAltitude') ?? self::DEFAULT_MIN) : null;
    }

    public function maxFor(string $productId): int
    {
        if (isset($this->cache[$productId])) {
            return $this->cache[$productId];
        }

        $destinations = DB::table('catalog_product_destinations')->where('product_id', $productId)->pluck('destination_id')
            ->push(DB::table('catalog_products')->where('id', $productId)->value('primary_destination_id'))->filter()->unique()->values();
        $texts = DB::table('catalog_destination_contents')->whereIn('destination_id', $destinations->all())->pluck('altitude_text');

        return $this->cache[$productId] = (int) $texts->map(fn (mixed $text): int => self::meters((string) $text))->max();
    }

    public function requires(string $productId): ?int
    {
        $threshold = $this->threshold();

        if ($threshold === null) {
            return null;
        }

        $max = $this->maxFor($productId);

        return $max >= $threshold ? $max : null;
    }

    public static function meters(string $text): int
    {
        return preg_match('/(\d[\d\s.,]*\d|\d)/u', $text, $match) === 1 ? (int) preg_replace('/\D/', '', $match[1]) : 0;
    }
}
