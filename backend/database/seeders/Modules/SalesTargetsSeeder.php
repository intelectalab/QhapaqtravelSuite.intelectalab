<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Crm\Support\TargetPeriod;
use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class SalesTargetsSeeder
{
    use SeedsTenant;

    private const KIT_MONTH = '2026-09';

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        $policy = KitSeeds::read('salesTargetPolicy');
        $this->upsert('crm_sales_target_policies', [], [
            'tiers' => json_encode($policy['tiers']),
            'primary_metric' => $policy['primary'],
            'lock_decrease_after_pct' => $policy['lockDecreaseAfterPct'],
            'attribution_window_days' => $policy['attributionWindowDays'],
        ]);

        $teams = [];
        foreach (KitSeeds::read('salesTeams') as $seed) {
            $teams[$seed['id']] = $this->upsert('crm_sales_teams', ['code' => $seed['id']], ['name' => $seed['name'], 'leader_id' => $this->userId($seed['leader'])]);
            foreach ($seed['members'] as $member) {
                $this->upsert('crm_sales_team_members', ['team_id' => $teams[$seed['id']], 'user_id' => $this->userId($member), 'valid_from' => '2026-01-01'], ['valid_to' => null]);
            }
        }

        $months = (int) Carbon::parse(self::KIT_MONTH.'-01')->diffInMonths(Carbon::today()->startOfMonth());

        foreach (KitSeeds::read('salesTargets') as $seed) {
            $key = $this->shiftPeriod($seed['period'], $months);
            [$from, $to] = TargetPeriod::range($key);
            $scope = match ($seed['scopeType']) {
                'asesor' => $this->userId($seed['scopeId']),
                'sede' => $this->idByCode('iam_sedes', $seed['scopeId']),
                default => $teams[$seed['scopeId']] ?? null,
            };
            $result = $seed['result'] ?? null;

            $id = $this->upsert('crm_sales_targets', ['code' => $seed['id']], [
                'scope_type' => $seed['scopeType'],
                'scope_id' => $scope,
                'period_type' => $seed['periodType'],
                'period_key' => $key,
                'period_from' => $from,
                'period_to' => $to,
                'goal_sales_pen' => $seed['goals']['sales'],
                'goal_bookings' => $seed['goals']['bookings'],
                'goal_margin_pen' => $seed['goals']['margin'],
                'goal_conversion_pct' => $seed['goals']['conversion'],
                'bonus_amount' => $seed['bonus']['amount'] ?? null,
                'bonus_currency' => isset($seed['bonus']) ? ($seed['bonus']['currency'] ?? 'PEN') : null,
                'status' => $seed['status'],
                'result' => $result ? json_encode([
                    'sales' => $result['sales'],
                    'bookings' => $result['bookings'],
                    'margin' => $result['margin'],
                    'conversion' => $result['conversion'],
                    'closed_at' => $this->moment($result['closedAt'] ?? null),
                    'closed_by' => $this->userId($result['closedBy'] ?? null),
                ]) : null,
                'created_by' => $this->userId($seed['createdBy']),
                'created_at' => $this->moment($seed['createdAt']),
                'updated_at' => $this->moment($seed['createdAt']),
            ]);

            if (DB::table('crm_sales_target_adjustments')->where('target_id', $id)->exists()) {
                continue;
            }

            foreach ($seed['history'] ?? [] as $index => $entry) {
                $message = (string) $entry['m'];
                $action = match (true) {
                    str_contains($message, 'cerrado') => 'cerrar',
                    str_contains($message, 'justad') || str_contains($message, 'juste') => 'ajustar',
                    str_contains($message, 'nulad') => 'anular',
                    $index > 0 && str_contains($message, 'ctivad') => 'activar',
                    default => 'crear',
                };
                DB::table('crm_sales_target_adjustments')->insert([
                    'id' => (string) Str::uuid7(),
                    'tenant_id' => $this->tenant->getKey(),
                    'target_id' => $id,
                    'action' => $action,
                    'reason' => $message,
                    'actor_id' => $this->userId($entry['u'] ?? null),
                    'occurred_at' => $this->moment($entry['ts']),
                ]);
            }
        }
    }

    private function shiftPeriod(string $period, int $months): string
    {
        if (str_contains($period, 'Q')) {
            [$year, $quarter] = explode('-Q', $period);
            $start = Carbon::create((int) $year, ((int) $quarter - 1) * 3 + 1, 1)->addMonths((int) (ceil($months / 3) * 3));

            return $start->format('Y').'-Q'.(int) ceil($start->month / 3);
        }

        return Carbon::parse("{$period}-01")->addMonths($months)->format('Y-m');
    }
}
