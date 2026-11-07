<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Support\Facades\DB;

final class RuleDirectory
{
    public const GROUPS = ['Disponibilidad', 'Pasajeros', 'Alojamiento', 'Adicionales', 'Precios', 'Monedas y pagos', 'Checkout', 'Comunicación'];

    private const PLAN_RANK = ['Starter' => 1, 'Professional' => 2, 'Enterprise' => 3];

    public function __construct(private readonly SettingsDirectory $settings, private readonly AuditDirectory $audit) {}

    public function list(User $viewer): array
    {
        $rank = $this->settings->planRank();
        $defaults = DB::table('sys_booking_rule_catalog')->get(['code', 'default_enabled', 'default_params'])->keyBy('code');
        $rules = DB::table('sys_booking_rules as r')
            ->leftJoin('iam_users as u', 'u.id', '=', 'r.updated_by')
            ->orderBy('r.sort_order')
            ->get(['r.code', 'r.rule_group', 'r.name', 'r.description', 'r.enabled', 'r.params', 'r.scope', 'r.product_override', 'r.is_custom', 'r.depends_on', 'r.min_plan', 'r.updated_at', 'r.lock_version', 'u.name as user_name'])
            ->map(function (object $row) use ($rank, $defaults): array {
                $params = (array) json_decode((string) $row->params, true);
                $default = $defaults[$row->code] ?? null;

                return [
                    'code' => $row->code,
                    'group' => $row->rule_group,
                    'name' => $row->name,
                    'description' => $row->description,
                    'enabled' => (bool) $row->enabled,
                    'params' => RuleParams::describe($row->code, $params),
                    'scope' => PgArray::parse($row->scope),
                    'product_override' => (bool) $row->product_override,
                    'custom' => (bool) $row->is_custom,
                    'depends_on' => $row->depends_on,
                    'min_plan' => $row->min_plan,
                    'locked' => $rank < (self::PLAN_RANK[$row->min_plan] ?? 1),
                    'modified' => $default !== null && ((bool) $default->default_enabled !== (bool) $row->enabled || (array) json_decode((string) $default->default_params, true) != $params),
                    'updated_at' => $row->updated_at,
                    'updated_by' => $row->user_name,
                    'lock_version' => (int) $row->lock_version,
                ];
            });

        return [
            'rules' => $rules->values(),
            'groups' => collect(self::GROUPS)->map(fn (string $group): array => [
                'name' => $group,
                'total' => $rules->where('group', $group)->count(),
                'active' => $rules->where('group', $group)->where('enabled', true)->count(),
            ])->filter(fn (array $group): bool => $group['total'] > 0)->values(),
            'plan' => SettingsCatalog::PLAN_NAMES[$rank] ?? 'Starter',
            'history' => $this->audit->recent(['Regla de reserva'], 8),
            'can_manage' => $viewer->can('admin.settings.manage'),
        ];
    }
}
