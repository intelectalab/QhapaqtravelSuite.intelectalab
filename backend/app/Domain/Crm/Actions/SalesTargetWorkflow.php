<?php

declare(strict_types=1);

namespace App\Domain\Crm\Actions;

use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Crm\Support\SalesTargetDirectory;
use App\Domain\Crm\Support\TargetPeriod;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class SalesTargetWorkflow
{
    private const GOALS = ['goal_sales_pen' => 'sales', 'goal_bookings' => 'bookings', 'goal_margin_pen' => 'margin', 'goal_conversion_pct' => 'conversion'];

    public function __construct(
        private readonly CodeSequence $codes,
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
        private readonly SalesTargetDirectory $directory,
    ) {}

    public function create(array $data, User $actor): string
    {
        [$from, $to] = TargetPeriod::range($data['period']);
        $today = $this->today();

        if ($to < $today->toDateString()) {
            throw ApiException::unprocessable('MET-BR-03', 'No se crean metas para períodos terminados.');
        }

        $this->assertScope($data['scope_type'], $data['scope_id']);

        if (DB::table('crm_sales_targets')->where('scope_type', $data['scope_type'])->where('scope_id', $data['scope_id'])->where('period_key', $data['period'])->where('status', '<>', 'anulada')->exists()) {
            throw ApiException::conflict('MET-BR-01', 'Ya existe una meta para ese alcance y período.');
        }

        return DB::transaction(function () use ($data, $actor, $from, $to): string {
            $code = $this->codes->next('crm_sales_targets', 'MET-');
            $id = (string) Str::uuid7();
            $status = ($data['activate'] ?? false) ? 'vigente' : 'borrador';
            $goals = $this->goals($data);

            DB::table('crm_sales_targets')->insert([
                'id' => $id,
                'code' => $code,
                'scope_type' => $data['scope_type'],
                'scope_id' => $data['scope_id'],
                'period_type' => TargetPeriod::type($data['period']),
                'period_key' => $data['period'],
                'period_from' => $from,
                'period_to' => $to,
                ...$goals,
                'bonus_amount' => $data['scope_type'] === 'asesor' ? ($data['bonus_amount'] ?? null) : null,
                'bonus_currency' => $data['scope_type'] === 'asesor' && isset($data['bonus_amount']) ? 'PEN' : null,
                'status' => $status,
                'created_by' => $actor->getKey(),
            ]);
            $this->history($id, 'crear', null, $goals, $status === 'vigente' ? 'Meta creada y activada' : 'Meta creada en borrador', $actor);
            $this->audit->log('Meta comercial', $code, 'crear', null, "{$data['period']} · S/ {$data['goal_sales']}");

            return $code;
        });
    }

    public function adjust(string $code, array $data, User $actor): void
    {
        $target = $this->find($code);

        if (! in_array($target->status, ['borrador', 'vigente'], true)) {
            throw ApiException::conflict('MET-STATE', 'Solo se ajustan metas en borrador o vigentes.');
        }

        $before = $this->current($target);
        $after = $this->goals($data);
        $decreases = collect(self::GOALS)->keys()->contains(fn (string $column): bool => $before[$column] !== null && $after[$column] !== null && (float) $after[$column] < (float) $before[$column])
            || ($target->bonus_amount !== null && isset($data['bonus_amount']) && (float) $data['bonus_amount'] < (float) $target->bonus_amount);
        $from = Carbon::parse($target->period_from);
        $days = $from->diffInDays(Carbon::parse($target->period_to)) + 1;
        $elapsed = max(0, $from->diffInDays($this->today(), false) + 1) / $days * 100;
        $limit = $this->directory->policy()['lock_decrease_after_pct'];

        if ($target->status === 'vigente' && $decreases && $elapsed > $limit && ! $actor->can('admin.settings.manage')) {
            throw ApiException::forbidden('MET-BR-05', "Pasado el {$limit} % del período, solo el administrador puede reducir una meta vigente.");
        }

        DB::transaction(function () use ($target, $data, $actor, $before, $after): void {
            DB::table('crm_sales_targets')->where('id', $target->id)->update([
                ...$after,
                'bonus_amount' => $target->scope_type === 'asesor' ? ($data['bonus_amount'] ?? $target->bonus_amount) : null,
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);
            $this->history($target->id, 'ajustar', $before, $after, $data['reason'], $actor);
            $this->audit->log('Meta comercial', $target->code, 'ajustar', 'S/ '.$before['goal_sales_pen'], 'S/ '.$after['goal_sales_pen'].' · '.$data['reason']);
        });
    }

    public function activate(string $code, User $actor): void
    {
        $target = $this->find($code);

        if ($target->status !== 'borrador') {
            throw ApiException::conflict('MET-STATE', 'Solo se activan metas en borrador.');
        }

        $this->change($target, 'vigente', 'activar', 'Meta activada', $actor);
    }

    public function void(string $code, string $reason, User $actor): void
    {
        $target = $this->find($code);

        if (! in_array($target->status, ['borrador', 'vigente'], true)) {
            throw ApiException::conflict('MET-STATE', 'Esta meta ya no se puede anular.');
        }

        $this->change($target, 'anulada', 'anular', $reason, $actor);
    }

    public function close(string $code, User $actor): void
    {
        $target = $this->find($code);

        if ($target->status !== 'vigente') {
            throw ApiException::conflict('MET-STATE', 'Solo se cierran metas vigentes.');
        }

        if ($target->period_to >= $this->today()->toDateString()) {
            throw ApiException::unprocessable('MET-BR-06', 'El período aún no termina; ciérralo después del '.Carbon::parse($target->period_to)->format('d/m/Y').'.');
        }

        $progress = $this->directory->progress($target, $this->today());
        DB::transaction(function () use ($target, $actor, $progress): void {
            DB::table('crm_sales_targets')->where('id', $target->id)->update([
                'status' => 'cerrada',
                'result' => json_encode([
                    'sales' => $progress['sales'],
                    'bookings' => $progress['bookings'],
                    'margin' => $progress['margin'],
                    'conversion' => $progress['conversion'],
                    'reservation_ids' => array_column($progress['reservations'], 'code'),
                    'closed_at' => now()->toIso8601String(),
                    'closed_by' => $actor->getKey(),
                ]),
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);
            $pct = (float) $target->goal_sales_pen > 0 ? round($progress['sales'] / (float) $target->goal_sales_pen * 100, 1) : 0;
            $this->history($target->id, 'cerrar', null, null, "Período cerrado · cumplimiento {$pct} %", $actor);
            $this->audit->log('Meta comercial', $target->code, 'cerrar', 'vigente', "cerrada · {$pct} %");
        });
    }

    private function change(object $target, string $status, string $action, string $reason, User $actor): void
    {
        DB::transaction(function () use ($target, $status, $action, $reason, $actor): void {
            DB::table('crm_sales_targets')->where('id', $target->id)->update(['status' => $status, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->history($target->id, $action, null, null, $reason, $actor);
            $this->audit->log('Meta comercial', $target->code, $action, $target->status, $status);
        });
    }

    private function goals(array $data): array
    {
        return [
            'goal_sales_pen' => $data['goal_sales'],
            'goal_bookings' => $data['goal_bookings'] ?? null,
            'goal_margin_pen' => $data['goal_margin'] ?? null,
            'goal_conversion_pct' => $data['goal_conversion'] ?? null,
        ];
    }

    private function current(object $target): array
    {
        return collect(self::GOALS)->keys()->mapWithKeys(fn (string $column): array => [$column => $target->{$column}])->all();
    }

    private function history(string $targetId, string $action, ?array $before, ?array $after, ?string $reason, User $actor): void
    {
        DB::table('crm_sales_target_adjustments')->insert([
            'id' => (string) Str::uuid7(),
            'target_id' => $targetId,
            'action' => $action,
            'before' => $before === null ? null : json_encode($before),
            'after' => $after === null ? null : json_encode($after),
            'reason' => $reason,
            'actor_id' => $actor->getKey(),
            'occurred_at' => now(),
        ]);
    }

    private function assertScope(string $type, string $id): void
    {
        $exists = match ($type) {
            'asesor' => DB::table('iam_users')->where('id', $id)->where('status', 'activo')->exists(),
            'sede' => DB::table('iam_sedes')->where('id', $id)->exists(),
            default => DB::table('crm_sales_teams')->where('id', $id)->exists(),
        };

        if (! $exists) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige a quién corresponde la meta.');
        }
    }

    private function find(string $code): object
    {
        return DB::table('crm_sales_targets')->where('code', $code)->first() ?? throw ApiException::notFound('La meta no existe.');
    }

    private function today(): Carbon
    {
        return Carbon::now($this->context->timezone())->startOfDay();
    }
}
