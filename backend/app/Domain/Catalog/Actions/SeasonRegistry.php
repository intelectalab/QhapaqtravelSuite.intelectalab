<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Actions;

use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

final class SeasonRegistry
{
    public function __construct(private readonly AuditLogger $audit, private readonly CodeSequence $codes) {}

    public function create(array $data, User $actor): string
    {
        return $this->guarded(function () use ($data, $actor): string {
            $values = $this->values($data);
            $this->assertNoClash($values, null);
            $ref = $this->codes->next('catalog_seasons', 'TMP-', 2, 'ref');
            DB::table('catalog_seasons')->insert([...$values, 'ref' => $ref, 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
            $this->audit->log('Temporada', $ref, 'crear', after: "{$values['name']} · {$values['date_from']} a {$values['date_to']} · prioridad {$values['priority']} · factor {$values['factor']}");

            return $ref;
        });
    }

    public function update(string $ref, array $data, User $actor): string
    {
        return $this->guarded(function () use ($ref, $data, $actor): string {
            $season = $this->season($ref);
            $values = $this->values($data);
            $this->assertNoClash($values, $season->id);
            DB::table('catalog_seasons')->where('id', $season->id)->update([...$values, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Temporada', $ref, 'modificar', "{$season->date_from} a {$season->date_to} · prioridad {$season->priority} · factor {$season->factor} · {$season->status}", "{$values['date_from']} a {$values['date_to']} · prioridad {$values['priority']} · factor {$values['factor']} · {$values['status']}");

            return $ref;
        });
    }

    public function setActive(string $ref, bool $active, User $actor): void
    {
        $this->guarded(function () use ($ref, $active, $actor): string {
            $season = $this->season($ref);

            if (($season->status === 'activa') === $active) {
                return $ref;
            }

            if ($active) {
                $this->assertNoClash(['date_from' => $season->date_from, 'date_to' => $season->date_to, 'priority' => (int) $season->priority, 'status' => 'activa'], $season->id);
            }

            DB::table('catalog_seasons')->where('id', $season->id)->update(['status' => $active ? 'activa' : 'inactiva', 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Temporada', $ref, $active ? 'activar' : 'desactivar', $season->status, $active ? 'activa' : 'inactiva');

            return $ref;
        });
    }

    private function season(string $ref): object
    {
        return DB::table('catalog_seasons')->where('ref', $ref)->whereNull('deleted_at')->lockForUpdate()->first() ?? throw ApiException::notFound('La temporada no existe.');
    }

    private function values(array $data): array
    {
        return [
            'name' => trim($data['name']),
            'type' => $data['type'],
            'date_from' => $data['date_from'],
            'date_to' => $data['date_to'],
            'priority' => (int) $data['priority'],
            'factor' => round((float) $data['factor'], 2),
            'status' => $data['status'] ?? 'activa',
        ];
    }

    private function assertNoClash(array $values, ?string $exceptId): void
    {
        if ($values['status'] !== 'activa') {
            return;
        }

        $clash = DB::table('catalog_seasons')->whereNull('deleted_at')->where('status', 'activa')->where('priority', $values['priority'])
            ->where('date_from', '<=', $values['date_to'])->where('date_to', '>=', $values['date_from'])
            ->when($exceptId, fn ($query) => $query->where('id', '<>', $exceptId))
            ->first(['ref', 'name']);

        if ($clash) {
            throw ApiException::unprocessable('PROC-019', "Se cruza con {$clash->name} ({$clash->ref}) y tiene la misma prioridad. Cambia la prioridad o las fechas.");
        }
    }

    private function guarded(callable $work): string
    {
        try {
            return DB::transaction($work);
        } catch (QueryException $exception) {
            if ($exception->getCode() === '23P01') {
                throw ApiException::unprocessable('PROC-019', 'Hay otra temporada activa con la misma prioridad en esas fechas.');
            }

            throw $exception;
        }
    }
}
