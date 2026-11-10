<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use Carbon\CarbonImmutable;

final class SupplierPaymentTerms
{
    public const DEFAULT_CREDIT_DAYS = 15;

    public const PREPAY_LEAD_DAYS = 7;

    public static function dueDate(?string $terms, CarbonImmutable $serviceDate, CarbonImmutable $today): CarbonImmutable
    {
        $text = mb_strtolower(trim((string) $terms));

        return match (true) {
            str_contains($text, 'prepago') || str_contains($text, 'adelantado') => self::prepaid($serviceDate, $today),
            str_contains($text, 'contado') => $serviceDate,
            preg_match('/(\d{1,3})\s*d[ií]as?/u', $text, $days) === 1 => $serviceDate->addDays((int) $days[1]),
            str_contains($text, 'semanal') => $serviceDate->next(CarbonImmutable::MONDAY),
            str_contains($text, 'quincenal') => $serviceDate->day <= 15 ? $serviceDate->setDay(15) : $serviceDate->endOfMonth()->startOfDay(),
            str_contains($text, 'mensual') => $serviceDate->endOfMonth()->startOfDay(),
            default => $serviceDate->addDays(self::DEFAULT_CREDIT_DAYS),
        };
    }

    private static function prepaid(CarbonImmutable $serviceDate, CarbonImmutable $today): CarbonImmutable
    {
        $lead = $serviceDate->subDays(self::PREPAY_LEAD_DAYS);

        return ($lead->lessThan($today) ? $today : $lead)->min($serviceDate);
    }
}
