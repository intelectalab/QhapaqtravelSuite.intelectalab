<?php

declare(strict_types=1);

namespace App\Domain\Booking\Data;

final readonly class SeasonCalendar
{
    public function __construct(private array $seasons) {}

    public static function fromArray(array $rows): self
    {
        $seasons = [];
        foreach ($rows as $s) {
            if (($s['status'] ?? 'activa') !== 'activa') {
                continue;
            }
            $seasons[] = (object) [
                'name' => (string) $s['name'], 'from' => (string) $s['from'], 'to' => (string) $s['to'],
                'priority' => (int) ($s['priority'] ?? 99), 'factor' => (string) $s['factor'],
            ];
        }
        usort($seasons, fn (object $a, object $b) => $a->priority <=> $b->priority);

        return new self($seasons);
    }

    public function for(string $date): ?object
    {
        foreach ($this->seasons as $s) {
            if ($date >= $s->from && $date <= $s->to) {
                return $s;
            }
        }

        return null;
    }
}
