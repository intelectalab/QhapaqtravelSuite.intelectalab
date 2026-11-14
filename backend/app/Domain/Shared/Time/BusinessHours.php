<?php

declare(strict_types=1);

namespace App\Domain\Shared\Time;

use App\Domain\Shared\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

final class BusinessHours
{
    public const SECTION = 'general';

    public const KEY = 'business_hours';

    public const NOTICE = 'Carga tu horario de atención';

    private array $cache = [];

    public function __construct(private readonly TenantContext $context) {}

    public function schedule(): BusinessSchedule
    {
        $tenantId = (string) $this->context->idOrFail();

        return $this->cache[$tenantId] ??= $this->load();
    }

    public function forget(): void
    {
        $this->cache = [];
    }

    public function configured(): bool
    {
        return $this->schedule()->configured;
    }

    public function timezone(): string
    {
        return $this->schedule()->timezone;
    }

    public function now(): CarbonImmutable
    {
        return CarbonImmutable::now($this->timezone());
    }

    public function isOpen(?CarbonInterface $at = null): bool
    {
        return $this->schedule()->isOpen($at ?? $this->now());
    }

    public function nextOpen(?CarbonInterface $at = null): CarbonImmutable
    {
        return $this->schedule()->nextOpen($at ?? $this->now());
    }

    public function closesAt(?CarbonInterface $at = null): ?CarbonImmutable
    {
        return $this->schedule()->closesAt($at ?? $this->now());
    }

    public function addMinutes(CarbonInterface $from, int $minutes): CarbonImmutable
    {
        return $this->schedule()->addMinutes($from, $minutes);
    }

    public function minutesBetween(CarbonInterface $from, CarbonInterface $to): int
    {
        return $this->schedule()->minutesBetween($from, $to);
    }

    public function summary(string $locale = 'es'): string
    {
        return $this->schedule()->summary($locale);
    }

    public function overview(): array
    {
        $schedule = $this->schedule();
        $row = DB::table('sys_settings as s')->leftJoin('iam_users as u', 'u.id', '=', 's.updated_by')->where('s.section', self::SECTION)->first(['s.updated_at', 's.lock_version', 'u.name as user_name']);

        return [
            'configured' => $schedule->configured,
            'notice' => $schedule->configured ? null : self::NOTICE,
            'timezone' => $schedule->timezone,
            'days' => $schedule->days(),
            'summary' => ['es' => $schedule->summary('es'), 'en' => $schedule->summary('en')],
            'open_now' => $this->isOpen(),
            'next_open' => $this->nextOpen()->utc()->toIso8601String(),
            'updated_at' => $row->updated_at ?? null,
            'updated_by' => $row->user_name ?? null,
            'lock_version' => isset($row->lock_version) ? (int) $row->lock_version : 0,
        ];
    }

    public function publicView(): array
    {
        $schedule = $this->schedule();

        return [
            'summary' => ['es' => $schedule->summary('es'), 'en' => $schedule->summary('en')],
            'open_now' => $this->isOpen(),
            'next_open' => $this->nextOpen()->utc()->toIso8601String(),
            'timezone' => $schedule->timezone,
            'days' => $schedule->days(),
        ];
    }

    private function load(): BusinessSchedule
    {
        $values = DB::table('sys_settings')->where('section', self::SECTION)->value('values');
        $decoded = is_string($values) ? json_decode($values, true) : null;

        return BusinessSchedule::fromDays(is_array($decoded) ? ($decoded[self::KEY] ?? null) : null, $this->context->timezone());
    }
}
