<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use App\Domain\Shared\Tenancy\TenantContext;
use Brick\Math\BigDecimal;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final class NotificationRules
{
    public const AMOUNT_THRESHOLD_PEN = '5000';

    public const BUSINESS_FROM = 8;

    public const BUSINESS_TO = 19;

    public const FACTS = ['amount', 'currency', 'marketing'];

    public function __construct(private readonly TenantContext $context) {}

    public static function withoutFacts(array $link): array
    {
        return array_diff_key($link, array_flip(self::FACTS));
    }

    public function rule(string $event): ?object
    {
        return DB::table('notif_event_rules')->where('event_code', $event)->first(['ch_email', 'ch_whatsapp', 'ch_push', 'ch_portal', 'timing', 'condition']);
    }

    public function allows(string $event, array $facts = []): bool
    {
        return match ($this->rule($event)->condition ?? 'always') {
            'marketing_consent' => $this->consented($facts),
            'amount_gt_5000' => $this->overThreshold($facts),
            default => true,
        };
    }

    public function releaseAt(string $event, ?CarbonImmutable $now = null): ?CarbonImmutable
    {
        $now ??= CarbonImmutable::now($this->context->timezone());

        return match ($this->rule($event)->timing ?? 'immediate') {
            'batch_15m' => $now->setTime($now->hour, intdiv($now->minute, 15) * 15)->addMinutes(15),
            'business_hours' => $this->nextBusinessMoment($now),
            default => null,
        };
    }

    private function nextBusinessMoment(CarbonImmutable $now): ?CarbonImmutable
    {
        if ($now->hour >= self::BUSINESS_FROM && $now->hour < self::BUSINESS_TO) {
            return null;
        }

        $day = $now->hour < self::BUSINESS_FROM ? $now : $now->addDay();

        return $day->setTime(self::BUSINESS_FROM, 0);
    }

    private function consented(array $facts): bool
    {
        if (array_key_exists('marketing', $facts)) {
            return (bool) $facts['marketing'];
        }

        $clientId = $facts['client_id'] ?? null;
        $consents = $clientId ? json_decode((string) DB::table('crm_clients')->where('id', $clientId)->value('consents'), true) : null;

        if (! is_array($consents)) {
            return false;
        }

        return ($consents['marketing'] ?? false) === true || ! empty($consents['marketing_at'])
            || collect($consents)->contains(fn (mixed $entry): bool => is_array($entry) && ($entry['purpose'] ?? null) === 'marketing' && ($entry['granted'] ?? false));
    }

    private function overThreshold(array $facts): bool
    {
        [$amount, $currency] = [$facts['amount'] ?? null, $facts['currency'] ?? 'PEN'];

        if ($amount === null && ! empty($facts['reservation_id'])) {
            $reservation = DB::table('booking_reservations')->where('id', $facts['reservation_id'])->first(['total_amount', 'currency']);
            [$amount, $currency] = [$reservation?->total_amount, $reservation->currency ?? 'PEN'];
        }

        if ($amount === null) {
            return true;
        }

        $rate = trim((string) $currency) === 'PEN' ? '1' : (string) (DB::table('fin_fx_rates')->where('currency_code', trim((string) $currency))->orderByDesc('rate_date')->orderByDesc('effective_at')->value('rate_pen') ?? '1');

        return BigDecimal::of((string) $amount)->multipliedBy($rate)->isGreaterThan(self::AMOUNT_THRESHOLD_PEN);
    }
}
