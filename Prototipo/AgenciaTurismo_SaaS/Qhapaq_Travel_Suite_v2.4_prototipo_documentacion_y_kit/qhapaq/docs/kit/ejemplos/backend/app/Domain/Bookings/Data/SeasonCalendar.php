<?php

declare(strict_types=1);

namespace App\Domain\Bookings\Data;

/**
 * Temporadas del tenant (`catalog_seasons`; spec 00 §5.1 `seasonFor`): activas que contienen la fecha,
 * ordenadas por `priority` ascendente (0 = mayor prioridad: feriados/fechas especiales) → la primera.
 * EXCLUDE de temporadas en SQL evita solapes del mismo nivel.
 */
final readonly class SeasonCalendar
{
    /** @param list<object{name:string, from:string, to:string, priority:int, factor:string}> $seasons */
    public function __construct(private array $seasons)
    {
    }

    /** Desde kit-ia/seeds/seasons.json (id, name, type, from, to, priority, factor, status). */
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
