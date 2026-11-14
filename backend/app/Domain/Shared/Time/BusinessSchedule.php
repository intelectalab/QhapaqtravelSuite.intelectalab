<?php

declare(strict_types=1);

namespace App\Domain\Shared\Time;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

final class BusinessSchedule
{
    public const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

    public const DEFAULT_FROM = '08:00';

    public const DEFAULT_TO = '19:00';

    public const DEFAULT_TIMEZONE = 'America/Lima';

    public const TIME_PATTERN = '/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/';

    private const NAMES = [
        'es' => ['mon' => 'Lun', 'tue' => 'Mar', 'wed' => 'Mié', 'thu' => 'Jue', 'fri' => 'Vie', 'sat' => 'Sáb', 'sun' => 'Dom'],
        'en' => ['mon' => 'Mon', 'tue' => 'Tue', 'wed' => 'Wed', 'thu' => 'Thu', 'fri' => 'Fri', 'sat' => 'Sat', 'sun' => 'Sun'],
    ];

    private function __construct(private readonly array $days, public readonly string $timezone, public readonly bool $configured) {}

    public static function defaults(string $timezone = self::DEFAULT_TIMEZONE): self
    {
        return new self(self::defaultDays(), $timezone, false);
    }

    public static function defaultDays(): array
    {
        return collect(self::DAYS)->mapWithKeys(fn (string $day): array => [$day => ['open' => ! in_array($day, ['sat', 'sun'], true), 'from' => self::DEFAULT_FROM, 'to' => self::DEFAULT_TO]])->all();
    }

    public static function fromDays(mixed $days, string $timezone = self::DEFAULT_TIMEZONE): self
    {
        $normalized = self::normalize($days);

        return $normalized === null ? self::defaults($timezone) : new self($normalized, $timezone, true);
    }

    public static function normalize(mixed $days): ?array
    {
        if (! is_array($days)) {
            return null;
        }

        $result = [];

        foreach (self::DAYS as $day) {
            $entry = is_array($days[$day] ?? null) ? $days[$day] : [];
            $open = filter_var($entry['open'] ?? false, FILTER_VALIDATE_BOOLEAN);
            $from = (string) ($entry['from'] ?? self::DEFAULT_FROM);
            $to = (string) ($entry['to'] ?? self::DEFAULT_TO);

            if ($open && ! self::validRange($from, $to)) {
                return null;
            }

            $result[$day] = ['open' => $open, 'from' => $open ? $from : (preg_match(self::TIME_PATTERN, $from) ? $from : self::DEFAULT_FROM), 'to' => $open ? $to : (preg_match(self::TIME_PATTERN, $to) ? $to : self::DEFAULT_TO)];
        }

        return collect($result)->contains(fn (array $entry): bool => $entry['open']) ? $result : null;
    }

    public static function validRange(string $from, string $to): bool
    {
        return preg_match(self::TIME_PATTERN, $from) === 1 && $from !== '24:00' && preg_match(self::TIME_PATTERN, $to) === 1 && self::minuteOfDay($to) > self::minuteOfDay($from);
    }

    public function days(): array
    {
        return $this->days;
    }

    public function isOpen(CarbonInterface $at): bool
    {
        $local = $this->local($at);
        $window = $this->window($local);

        return $window !== null && $local->greaterThanOrEqualTo($window[0]) && $local->lessThan($window[1]);
    }

    public function nextOpen(CarbonInterface $at): CarbonImmutable
    {
        $local = $this->local($at);

        for ($offset = 0; $offset <= 7; $offset++) {
            $window = $this->window($local->startOfDay()->addDays($offset));

            if ($window === null) {
                continue;
            }

            if ($offset === 0) {
                if ($local->lessThan($window[1])) {
                    return $local->greaterThan($window[0]) ? $local : $window[0];
                }

                continue;
            }

            return $window[0];
        }

        return $local;
    }

    public function closesAt(CarbonInterface $at): ?CarbonImmutable
    {
        return $this->isOpen($at) ? $this->window($this->local($at))[1] ?? null : null;
    }

    public function addMinutes(CarbonInterface $from, int $minutes): CarbonImmutable
    {
        $cursor = $this->nextOpen($from);
        $remaining = max(0, $minutes) * 60;

        for ($guard = 0; $guard < 3700; $guard++) {
            $end = $this->window($cursor)[1] ?? $cursor;
            $available = $end->getTimestamp() - $cursor->getTimestamp();

            if ($remaining <= $available) {
                return $cursor->addSeconds($remaining);
            }

            $remaining -= $available;
            $cursor = $this->nextOpen($end);
        }

        return $cursor;
    }

    public function minutesBetween(CarbonInterface $from, CarbonInterface $to): int
    {
        $limit = $this->local($to);
        $cursor = $this->nextOpen($from);
        $seconds = 0;

        for ($guard = 0; $guard < 3700 && $cursor->lessThan($limit); $guard++) {
            $end = $this->window($cursor)[1] ?? $limit;
            $seconds += min($end->getTimestamp(), $limit->getTimestamp()) - $cursor->getTimestamp();
            $cursor = $this->nextOpen($end);
        }

        return intdiv(max(0, $seconds), 60);
    }

    public function summary(string $locale = 'es'): string
    {
        $locale = str_starts_with($locale, 'en') ? 'en' : 'es';
        $names = self::NAMES[$locale];
        $groups = [];

        foreach (self::DAYS as $day) {
            $entry = $this->days[$day];
            $last = array_key_last($groups);

            if ($entry['open'] && $last !== null && $groups[$last]['hours'] === $entry['from'].'–'.$entry['to'] && $groups[$last]['end'] === $this->previous($day)) {
                $groups[$last]['end'] = $day;
                $groups[$last]['count']++;

                continue;
            }

            if ($entry['open']) {
                $groups[] = ['start' => $day, 'end' => $day, 'count' => 1, 'hours' => $entry['from'].'–'.$entry['to']];
            }
        }

        if (count($groups) === 1 && $groups[0]['count'] === 7) {
            return ($locale === 'en' ? 'Every day ' : 'Todos los días ').$groups[0]['hours'];
        }

        return collect($groups)->map(function (array $group) use ($names, $locale): string {
            $label = match ($group['count']) {
                1 => $names[$group['start']],
                2 => $names[$group['start']].($locale === 'en' ? ' & ' : ' y ').($locale === 'en' ? $names[$group['end']] : mb_strtolower($names[$group['end']])),
                default => $names[$group['start']].($locale === 'en' ? '–' : ' a ').($locale === 'en' ? $names[$group['end']] : mb_strtolower($names[$group['end']])),
            };

            return $label.' '.$group['hours'];
        })->implode(' · ');
    }

    private function previous(string $day): ?string
    {
        $index = array_search($day, self::DAYS, true);

        return $index === false || $index === 0 ? null : self::DAYS[$index - 1];
    }

    private function window(CarbonImmutable $local): ?array
    {
        $entry = $this->days[self::DAYS[$local->dayOfWeekIso - 1]];

        if (! $entry['open']) {
            return null;
        }

        $day = $local->startOfDay();

        return [$day->addMinutes(self::minuteOfDay($entry['from'])), $day->addMinutes(self::minuteOfDay($entry['to']))];
    }

    private function local(CarbonInterface $at): CarbonImmutable
    {
        return CarbonImmutable::instance($at)->setTimezone($this->timezone);
    }

    private static function minuteOfDay(string $time): int
    {
        [$hours, $minutes] = array_map('intval', explode(':', $time));

        return $hours * 60 + $minutes;
    }
}
