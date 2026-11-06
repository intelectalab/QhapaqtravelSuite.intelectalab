<?php

declare(strict_types=1);

namespace App\Domain\Admin\Actions;

use App\Domain\Admin\Support\RuleParams;
use App\Domain\Admin\Support\SettingsDirectory;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class ManageBookingRules
{
    private const PLAN_RANK = ['Starter' => 1, 'Professional' => 2, 'Enterprise' => 3];

    public function __construct(private readonly AuditLogger $audit, private readonly SettingsDirectory $settings) {}

    public function toggle(string $code, bool $enabled, User $actor): void
    {
        DB::transaction(function () use ($code, $enabled, $actor): void {
            $rule = $this->find($code);

            if ((bool) $rule->enabled === $enabled) {
                throw ApiException::unprocessable('CFG-BR-01', $enabled ? 'La regla ya está activa.' : 'La regla ya está inactiva.');
            }

            if ($enabled && $this->settings->planRank() < (self::PLAN_RANK[$rule->min_plan] ?? 1)) {
                throw ApiException::forbidden('RULE_NOT_IN_PLAN', "Esta regla está disponible desde el plan {$rule->min_plan}.");
            }

            if ($enabled && $rule->depends_on && ! DB::table('sys_booking_rules')->where('code', $rule->depends_on)->value('enabled')) {
                throw ApiException::unprocessable('CR-05', "Primero activa la regla {$rule->depends_on}, de la que depende.");
            }

            DB::table('sys_booking_rules')->where('id', $rule->id)->update(['enabled' => $enabled, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Regla de reserva', $code, $enabled ? 'activar' : 'desactivar', $enabled ? 'inactiva' : 'activa', $enabled ? 'activa' : 'inactiva');
        });
    }

    public function params(string $code, array $input, User $actor): void
    {
        DB::transaction(function () use ($code, $input, $actor): void {
            $rule = $this->find($code);
            $current = (array) json_decode((string) $rule->params, true);
            [$clean, $errors] = RuleParams::validate($code, $current, $input);
            $errors = [...$errors, ...$this->crossRules($code, $clean)];

            if ($errors !== []) {
                throw ValidationException::withMessages($errors);
            }

            if ($clean == $current) {
                throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
            }

            DB::table('sys_booking_rules')->where('id', $rule->id)->update(['params' => json_encode($clean), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Regla de reserva', $code, 'editar_parametros', json_encode($current, JSON_UNESCAPED_UNICODE) ?: null, json_encode($clean, JSON_UNESCAPED_UNICODE) ?: null);
        });
    }

    public function reset(string $code, string $reason, User $actor): void
    {
        DB::transaction(function () use ($code, $reason, $actor): void {
            $rule = $this->find($code);
            $catalog = DB::table('sys_booking_rule_catalog')->where('code', $code)->first(['default_enabled', 'default_params']);

            if ($catalog === null) {
                throw ApiException::unprocessable('CR-04', 'Las reglas personalizadas no tienen valores de fábrica.');
            }

            $params = (array) json_decode((string) $catalog->default_params, true);
            DB::table('sys_booking_rules')->where('id', $rule->id)->update([
                'enabled' => (bool) $catalog->default_enabled,
                'params' => json_encode((object) $params),
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);
            $this->audit->log('Regla de reserva', $code, 'restablecer', (string) $rule->params, $reason);
        });
    }

    public function create(array $data, User $actor): string
    {
        return DB::transaction(function () use ($data, $actor): string {
            $slug = Str::upper(Str::limit(Str::slug($data['name']), 24, ''));
            $code = 'R-X-'.$slug;
            $suffix = 2;

            while (DB::table('sys_booking_rules')->where('code', $code)->exists()) {
                $code = 'R-X-'.Str::limit($slug, 20, '').'-'.$suffix++;
            }

            DB::table('sys_booking_rules')->insert([
                'code' => $code,
                'rule_group' => $data['group'],
                'name' => $data['name'],
                'description' => $data['description'],
                'enabled' => false,
                'params' => '{}',
                'params_schema' => '{}',
                'scope' => '{}',
                'product_override' => false,
                'is_custom' => true,
                'min_plan' => 'Starter',
                'sort_order' => (int) DB::table('sys_booking_rules')->max('sort_order') + 1,
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ]);
            $this->audit->log('Regla de reserva', $code, 'crear', null, "{$data['name']} · {$data['group']}");

            return $code;
        });
    }

    public function update(string $code, array $data, User $actor): void
    {
        $rule = $this->find($code);

        if (! $rule->is_custom) {
            throw ApiException::unprocessable('CR-04', 'Solo las reglas personalizadas cambian de nombre o descripción.');
        }

        DB::table('sys_booking_rules')->where('id', $rule->id)->update(['name' => $data['name'], 'description' => $data['description'], 'rule_group' => $data['group'], 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Regla de reserva', $code, 'editar', "{$rule->name} · {$rule->rule_group}", "{$data['name']} · {$data['group']}");
    }

    public function delete(string $code): void
    {
        $rule = $this->find($code);

        if (! $rule->is_custom) {
            throw ApiException::unprocessable('CR-04', 'Las reglas estándar no se eliminan: desactívalas.');
        }

        if ($rule->enabled) {
            throw ApiException::unprocessable('CR-04', 'Desactiva la regla antes de eliminarla.');
        }

        DB::table('sys_booking_rules')->where('id', $rule->id)->delete();
        $this->audit->log('Regla de reserva', $code, 'eliminar', $rule->name, null);
    }

    private function find(string $code): object
    {
        return DB::table('sys_booking_rules')->where('code', $code)->lockForUpdate()->first() ?? throw ApiException::notFound('La regla no existe.');
    }

    private function crossRules(string $code, array $clean): array
    {
        $param = fn (string $rule, string $key): ?int => $rule === $code ? ($clean[$key] ?? null) : (json_decode((string) DB::table('sys_booking_rules')->where('code', $rule)->value('params'), true)[$key] ?? null);
        $infantMax = $param('R-INFANT-FREE', 'infantMaxAge');
        $childMin = $param('R-CHILD-PER-ADULT', 'childMinAge');
        $childMax = $param('R-CHILD-PER-ADULT', 'childMaxAge');
        $adultMin = $param('R-MIN-ADULTS', 'adultMinAge');
        $errors = [];

        if ($infantMax !== null && $childMin !== null && $infantMax >= $childMin) {
            $errors[$code === 'R-INFANT-FREE' ? 'infantMaxAge' : 'childMinAge'] = 'La edad máxima de infante debe ser menor que la edad mínima de niño (CR-01).';
        }

        if ($childMax !== null && $adultMin !== null && $childMax >= $adultMin) {
            $errors[$code === 'R-MIN-ADULTS' ? 'adultMinAge' : 'childMaxAge'] = 'La edad máxima de niño debe ser menor que la edad de adulto (CR-01).';
        }

        return $errors;
    }
}
