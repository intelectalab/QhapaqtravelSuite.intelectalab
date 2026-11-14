<?php

declare(strict_types=1);

namespace App\Domain\Admin\Actions;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class RuleAutomationRequests
{
    public const STATUSES = ['enviado' => 'Enviado', 'en_evaluacion' => 'En evaluación', 'rechazado' => 'Rechazado', 'publicado' => 'Publicado'];

    public const OPEN = ['enviado', 'en_evaluacion'];

    private const CONNECTION = 'pgsql_platform';

    public function __construct(private readonly AuditLogger $audit, private readonly TenantContext $context) {}

    public static function rules(): array
    {
        return [
            'expected' => ['required', 'string', 'min:10', 'max:1000'],
            'trigger_when' => ['required', 'string', 'min:5', 'max:600'],
            'example' => ['required', 'string', 'min:10', 'max:1000'],
        ];
    }

    public static function messages(): array
    {
        return [
            'expected.*' => 'Cuenta qué debe pasar cuando se aplique la regla (entre 10 y 1000 caracteres).',
            'trigger_when.*' => 'Indica cuándo debe aplicarse (entre 5 y 600 caracteres).',
            'example.*' => 'Escribe un ejemplo concreto (entre 10 y 1000 caracteres).',
        ];
    }

    public function request(string $ruleCode, array $data, User $actor): array
    {
        $rule = DB::table('sys_booking_rules')->where('code', $ruleCode)->first(['code', 'name', 'is_custom']) ?? throw ApiException::notFound('La regla no existe.');

        if (! $rule->is_custom) {
            throw ApiException::unprocessable('CR-05', 'Solo las reglas personalizadas se piden para automatizar: las estándar ya tienen efecto.');
        }

        $tenantId = $this->context->idOrFail();
        $code = $this->db()->transaction(function () use ($rule, $data, $actor, $tenantId): string {
            if ($this->db()->table('platform_rule_requests')->where('tenant_id', $tenantId)->where('rule_code', $rule->code)->whereIn('status', self::OPEN)->lockForUpdate()->exists()) {
                throw ApiException::conflict('CR-05', 'Ya hay un pedido abierto para esta regla. Te avisaremos cuando la plataforma lo resuelva.');
            }

            $id = (string) Str::uuid7();
            $this->db()->table('platform_rule_requests')->insert([
                'id' => $id,
                'tenant_id' => $tenantId,
                'rule_code' => $rule->code,
                'rule_name' => $rule->name,
                'expected' => trim((string) $data['expected']),
                'trigger_when' => trim((string) $data['trigger_when']),
                'example' => trim((string) $data['example']),
                'requested_by' => $actor->getKey(),
                'requested_by_name' => mb_substr((string) $actor->name, 0, 160),
            ]);

            return (string) $this->db()->table('platform_rule_requests')->where('id', $id)->value('code');
        });

        $this->audit->log('Regla de reserva', $rule->code, 'pedir_automatizacion', null, "{$code} · ".mb_substr(trim((string) $data['expected']), 0, 160));

        return $this->latest()[$rule->code];
    }

    public function latest(): array
    {
        return $this->db()->table('platform_rule_requests')
            ->where('tenant_id', $this->context->idOrFail())
            ->orderBy('rule_code')->orderByDesc('created_at')
            ->get(['code', 'rule_code', 'status', 'decision_reason', 'linked_rule_code', 'created_at', 'decided_at'])
            ->unique('rule_code')
            ->mapWithKeys(fn (object $row): array => [$row->rule_code => [
                'code' => $row->code,
                'status' => $row->status,
                'status_label' => self::STATUSES[$row->status] ?? $row->status,
                'reason' => $row->decision_reason,
                'linked_rule' => $row->linked_rule_code,
                'requested_at' => $row->created_at,
                'decided_at' => $row->decided_at,
            ]])
            ->all();
    }

    private function db(): ConnectionInterface
    {
        return DB::connection(self::CONNECTION);
    }
}
