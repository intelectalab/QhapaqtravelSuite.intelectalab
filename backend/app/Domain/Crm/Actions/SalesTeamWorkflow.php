<?php

declare(strict_types=1);

namespace App\Domain\Crm\Actions;

use App\Domain\Crm\Support\Advisors;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class SalesTeamWorkflow
{
    public const METRICS = ['sales' => 'Ventas', 'margin' => 'Margen', 'bookings' => 'Reservas'];

    private const DEFAULT_TIERS = [['min' => 90, 'pay' => 50], ['min' => 100, 'pay' => 100], ['min' => 120, 'pay' => 130]];

    public function __construct(
        private readonly CodeSequence $codes,
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
        private readonly Advisors $advisors,
    ) {}

    public function teams(User $viewer): array
    {
        $today = $this->today()->toDateString();
        $users = DB::table('iam_users')->pluck('name', 'id');
        $members = DB::table('crm_sales_team_members')->where('valid_from', '<=', $today)->where(fn ($query) => $query->whereNull('valid_to')->orWhere('valid_to', '>=', $today))
            ->orderBy('valid_from')->get(['team_id', 'user_id', 'valid_from'])
            ->reduce(function (array $carry, object $member) use ($users): array {
                $carry[$member->team_id][] = ['id' => $member->user_id, 'name' => $users[$member->user_id] ?? 'Sin nombre', 'since' => $member->valid_from];

                return $carry;
            }, []);
        $targets = DB::table('crm_sales_targets')->where('scope_type', 'equipo')->where('status', '<>', 'anulada')->selectRaw('scope_id, count(*) as total')->groupBy('scope_id')->pluck('total', 'scope_id');

        return [
            'teams' => DB::table('crm_sales_teams')->orderBy('code')->get(['id', 'code', 'name', 'leader_id', 'updated_at'])->map(fn (object $team): array => [
                'id' => $team->id,
                'code' => $team->code,
                'name' => $team->name,
                'leader' => $team->leader_id ? ['id' => $team->leader_id, 'name' => $users[$team->leader_id] ?? 'Sin nombre'] : null,
                'members' => $members[$team->id] ?? [],
                'targets' => (int) ($targets[$team->id] ?? 0),
                'updated_at' => $team->updated_at,
            ])->values()->all(),
            'advisors' => $this->advisors->all(['manager', 'sales'])->map(fn (array $user): array => ['value' => $user['id'], 'label' => $user['name']])->values()->all(),
            'policy' => $this->policy(),
            'can' => ['manage' => $viewer->can('crm.targets.manage'), 'policy' => $viewer->can('admin.settings.manage')],
        ];
    }

    public function saveTeams(array $teams, User $actor): array
    {
        $names = collect($teams)->map(fn (array $team): string => Str::lower(trim($team['name'])));

        if ($names->duplicates()->isNotEmpty()) {
            throw ApiException::unprocessable('MET-TEAM-NAME', 'Dos equipos no pueden llamarse igual.');
        }

        $advisors = $this->advisors->all(['manager', 'sales'])->pluck('id')->all();
        $assigned = collect($teams)->flatMap(fn (array $team): array => $team['members'] ?? []);

        if ($assigned->duplicates()->isNotEmpty()) {
            throw ApiException::unprocessable('MET-TEAM-MEMBER', 'Un asesor solo puede estar en un equipo a la vez.');
        }

        if ($assigned->merge(collect($teams)->pluck('leader_id')->filter())->contains(fn (string $id): bool => ! in_array($id, $advisors, true))) {
            throw ApiException::unprocessable('MET-TEAM-MEMBER', 'Los integrantes y líderes deben ser asesores o gerentes activos.');
        }

        return DB::transaction(function () use ($teams, $actor): array {
            $today = $this->today();
            $existing = DB::table('crm_sales_teams')->lock('for no key update')->get(['id', 'code', 'name', 'leader_id'])->keyBy('code');
            $kept = collect($teams)->pluck('code')->filter()->map(fn (string $code): string => Str::upper($code))->all();
            $removed = $existing->reject(fn (object $team): bool => in_array($team->code, $kept, true));

            foreach ($removed as $team) {
                if (DB::table('crm_sales_targets')->where('scope_type', 'equipo')->where('scope_id', $team->id)->where('status', '<>', 'anulada')->exists()) {
                    throw ApiException::conflict('MET-TEAM-IN-USE', "El equipo {$team->name} tiene metas; anúlalas antes de quitarlo.");
                }

                DB::table('crm_sales_team_members')->where('team_id', $team->id)->delete();
                DB::table('crm_sales_teams')->where('id', $team->id)->delete();
                $this->audit->log('Equipo comercial', $team->code, 'eliminar', $team->name, null);
            }

            $result = [];

            foreach ($teams as $input) {
                $code = isset($input['code']) ? Str::upper($input['code']) : null;
                $team = $code !== null ? ($existing[$code] ?? throw ApiException::unprocessable('MET-TEAM', "El equipo {$code} no existe.")) : null;
                $values = ['name' => trim($input['name']), 'leader_id' => $input['leader_id'] ?? null, 'updated_by' => $actor->getKey(), 'updated_at' => now()];

                if ($team === null) {
                    $id = (string) Str::uuid7();
                    $code = $this->codes->next('crm_sales_teams', 'EQ-', 2);
                    DB::table('crm_sales_teams')->insert(['id' => $id, 'code' => $code, ...$values, 'created_by' => $actor->getKey()]);
                    $this->audit->log('Equipo comercial', $code, 'crear', null, $values['name']);
                } else {
                    $id = (string) $team->id;
                    DB::table('crm_sales_teams')->where('id', $id)->update($values);

                    if ($team->name !== $values['name'] || $team->leader_id !== $values['leader_id']) {
                        $this->audit->log('Equipo comercial', (string) $code, 'editar', $team->name, $values['name']);
                    }
                }

                $this->members($id, (string) $code, array_values(array_unique($input['members'] ?? [])), $today, $actor);
                $result[] = $code;
            }

            return $result;
        });
    }

    public function policy(): array
    {
        $row = DB::table('crm_sales_target_policies')->first();

        return [
            'tiers' => $row ? (array) json_decode((string) $row->tiers, true) : self::DEFAULT_TIERS,
            'primary_metric' => (string) ($row->primary_metric ?? 'sales'),
            'lock_decrease_after_pct' => (int) ($row->lock_decrease_after_pct ?? 50),
            'attribution_window_days' => (int) ($row->attribution_window_days ?? 30),
            'updated_at' => $row->updated_at ?? null,
        ];
    }

    public function savePolicy(array $data, User $actor): array
    {
        $tiers = collect($data['tiers'])->map(fn (array $tier): array => ['min' => (int) $tier['min'], 'pay' => (int) $tier['pay']])->sortBy('min')->values();

        if ($tiers->pluck('min')->duplicates()->isNotEmpty()) {
            throw ApiException::unprocessable('MET-BR-08', 'Cada tramo necesita un cumplimiento distinto.');
        }

        if ($tiers->pluck('pay')->sliding(2)->contains(fn ($pair): bool => $pair->last() < $pair->first())) {
            throw ApiException::unprocessable('MET-BR-08', 'Un tramo con más cumplimiento no puede pagar menos que el anterior.');
        }

        $before = $this->policy();
        $values = [
            'tiers' => json_encode($tiers->all()),
            'primary_metric' => $data['primary_metric'] ?? $before['primary_metric'],
            'lock_decrease_after_pct' => (int) ($data['lock_decrease_after_pct'] ?? $before['lock_decrease_after_pct']),
            'attribution_window_days' => (int) ($data['attribution_window_days'] ?? $before['attribution_window_days']),
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ];

        DB::transaction(function () use ($values, $before, $actor): void {
            $id = DB::table('crm_sales_target_policies')->lock('for no key update')->value('id');

            if ($id === null) {
                DB::table('crm_sales_target_policies')->insert(['id' => (string) Str::uuid7(), ...$values, 'created_by' => $actor->getKey()]);
            } else {
                DB::table('crm_sales_target_policies')->where('id', $id)->update($values);
            }

            $this->audit->log('Política de metas', 'bonos', 'editar', $this->label($before['tiers'], $before['lock_decrease_after_pct']), $this->label((array) json_decode((string) $values['tiers'], true), $values['lock_decrease_after_pct']));
        });

        return $this->policy();
    }

    private function members(string $teamId, string $code, array $members, Carbon $today, User $actor): void
    {
        $current = DB::table('crm_sales_team_members')->where('team_id', $teamId)->whereNull('valid_to')->pluck('user_id', 'id');
        $leaving = $current->reject(fn (string $user): bool => in_array($user, $members, true));
        $joining = array_values(array_diff($members, $current->values()->all()));
        $elsewhere = DB::table('crm_sales_team_members')->whereIn('user_id', $joining)->whereNull('valid_to')->where('team_id', '<>', $teamId)->pluck('id')->all();
        $this->close([...$leaving->keys()->all(), ...$elsewhere], $today, $actor);

        foreach ($joining as $user) {
            DB::table('crm_sales_team_members')->insert(['id' => (string) Str::uuid7(), 'team_id' => $teamId, 'user_id' => $user, 'valid_from' => $today->toDateString(), 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
        }

        if ($leaving->isNotEmpty() || $joining !== []) {
            $this->audit->log('Equipo comercial', $code, 'integrantes', $leaving->count().' salen', count($joining).' ingresan');
        }
    }

    private function close(array $ids, Carbon $today, User $actor): void
    {
        if ($ids === []) {
            return;
        }

        DB::table('crm_sales_team_members')->whereIn('id', $ids)->where('valid_from', '>=', $today->toDateString())->delete();
        DB::table('crm_sales_team_members')->whereIn('id', $ids)->where('valid_from', '<', $today->toDateString())->update(['valid_to' => $today->copy()->subDay()->toDateString(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
    }

    private function label(array $tiers, int $lock): string
    {
        return collect($tiers)->map(fn (array $tier): string => "{$tier['min']} % paga {$tier['pay']} %")->implode(' · ')." · reducir hasta {$lock} %";
    }

    private function today(): Carbon
    {
        return Carbon::now($this->context->timezone())->startOfDay();
    }
}
