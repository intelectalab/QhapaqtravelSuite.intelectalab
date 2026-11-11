<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Concurrency\IfMatch;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CommissionRules
{
    private const BASES = ['neto_sin_igv' => 'Venta neta sin IGV', 'total' => 'Total de la reserva'];

    public function __construct(private readonly AuditLogger $audit, private readonly TenantContext $context, private readonly Consolidation $money) {}

    public static function list(): array
    {
        $today = now()->toDateString();

        return DB::table('fin_commission_rules as r')->leftJoin('iam_users as u', 'u.id', '=', 'r.updated_by')
            ->orderByDesc('r.active')->orderBy('r.condition')->orderByDesc('r.valid_from')
            ->get(['r.id', 'r.lock_version', 'r.beneficiary_kind', 'r.condition', 'r.pct', 'r.base_type', 'r.valid_from', 'r.valid_to', 'r.active', 'r.updated_at', 'u.name as updated_by'])
            ->map(fn (object $rule): array => [
                'id' => $rule->id,
                'lock_version' => (int) $rule->lock_version,
                'condition' => $rule->condition,
                'condition_label' => CommissionDirectory::CONDITIONS[$rule->condition] ?? $rule->condition,
                'beneficiary' => $rule->beneficiary_kind === 'agencia_b2b' ? 'Agencia B2B' : 'Vendedor',
                'pct' => $rule->pct !== null ? (float) $rule->pct : null,
                'base_type' => $rule->base_type,
                'base' => self::BASES[$rule->base_type] ?? $rule->base_type,
                'valid_from' => $rule->valid_from,
                'valid_to' => $rule->valid_to,
                'active' => (bool) $rule->active,
                'in_force' => (bool) $rule->active && $rule->valid_from <= $today && ($rule->valid_to === null || $rule->valid_to >= $today),
                'used' => DB::table('fin_commissions')->where('rule_id', $rule->id)->whereNull('deleted_at')->count(),
                'updated_at' => $rule->updated_at,
                'updated_by' => $rule->updated_by,
            ])->values()->all();
    }

    public function save(?string $id, array $data, ?int $lockVersion, User $actor): string
    {
        return DB::transaction(function () use ($id, $data, $lockVersion, $actor): string {
            $current = $id === null ? null : (DB::table('fin_commission_rules')->where('id', $id)->lockForUpdate()->first() ?? throw ApiException::notFound('La regla no existe.'));

            if ($current !== null && $lockVersion !== null) {
                IfMatch::assertMatches($lockVersion, (int) $current->lock_version, 'La regla de comisión');
            }

            $condition = $data['condition'] ?? $current->condition;
            $values = [
                'condition' => $condition,
                'beneficiary_kind' => $condition === 'b2b_convenio' ? 'agencia_b2b' : 'vendedor',
                'pct' => $condition === 'b2b_convenio' ? null : (array_key_exists('pct', $data) ? $data['pct'] : $current?->pct),
                'base_type' => $data['base_type'] ?? $current->base_type ?? ($condition === 'b2b_convenio' ? 'total' : 'neto_sin_igv'),
                'valid_from' => $data['valid_from'] ?? $current->valid_from ?? $this->money->today(),
                'valid_to' => array_key_exists('valid_to', $data) ? $data['valid_to'] : $current?->valid_to,
                'active' => array_key_exists('active', $data) ? (bool) $data['active'] : ($current === null ? true : (bool) $current->active),
            ];

            if ($condition !== 'b2b_convenio' && $values['pct'] === null) {
                throw ApiException::unprocessable('VALIDATION_ERROR', 'Indica el porcentaje de la comisión.', ['pct' => ['Indica el porcentaje.']]);
            }

            if ($values['valid_to'] !== null && $values['valid_to'] < $values['valid_from']) {
                throw ApiException::unprocessable('VALIDATION_ERROR', 'La vigencia termina antes de empezar.', ['valid_to' => ['Debe ser posterior al inicio.']]);
            }

            if ($values['active'] && $this->overlaps($id, $values)) {
                throw ApiException::conflict('FIN-BR-25', 'Ya hay otra regla activa para '.mb_strtolower(CommissionDirectory::CONDITIONS[$condition]).' en esas fechas. Ciérrale la vigencia o desactívala primero.');
            }

            if ($current === null) {
                $id = (string) Str::uuid7();
                DB::table('fin_commission_rules')->insert([...$values, 'id' => $id, 'tenant_id' => $this->context->idOrFail(), 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey(), 'created_at' => now(), 'updated_at' => now()]);
                $this->audit->log('Regla de comisión', $id, 'crear', null, $this->summary($values));

                return $id;
            }

            DB::table('fin_commission_rules')->where('id', $current->id)->update([...$values, 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Regla de comisión', $current->id, $values['active'] === (bool) $current->active ? 'editar' : ($values['active'] ? 'activar' : 'desactivar'), $this->summary((array) $current), $this->summary($values));

            return $current->id;
        });
    }

    private function overlaps(?string $id, array $values): bool
    {
        return DB::table('fin_commission_rules')->where('condition', $values['condition'])->where('active', true)->when($id !== null, fn ($query) => $query->where('id', '<>', $id))
            ->where(fn ($query) => $query->whereNull('valid_to')->orWhere('valid_to', '>=', $values['valid_from']))
            ->when($values['valid_to'] !== null, fn ($query) => $query->where('valid_from', '<=', $values['valid_to']))
            ->exists();
    }

    private function summary(array $values): string
    {
        $pct = $values['pct'] === null ? 'convenio' : rtrim(rtrim((string) $values['pct'], '0'), '.').' %';

        return (CommissionDirectory::CONDITIONS[$values['condition']] ?? $values['condition'])." · {$pct} · desde {$values['valid_from']}".($values['valid_to'] ? " hasta {$values['valid_to']}" : '').($values['active'] ? '' : ' · inactiva');
    }
}
