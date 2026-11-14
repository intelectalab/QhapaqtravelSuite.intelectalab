<?php

declare(strict_types=1);

namespace App\Domain\Platform\Actions;

use App\Domain\Admin\Actions\RuleAutomationRequests;
use App\Domain\Admin\Support\StaffNotices;
use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Shared\Concurrency\IfMatch;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Shared\Tenancy\TenantDatabase;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;

final class RuleAutomationInbox
{
    public const DECISIONS = ['evaluar' => 'en_evaluacion', 'rechazar' => 'rechazado', 'publicar' => 'publicado'];

    private const CONNECTION = 'pgsql_platform';

    public function __construct(private readonly PlatformSession $session, private readonly TenantDatabase $tenants, private readonly TenantContext $context) {}

    public function overview(): array
    {
        $rows = $this->db()->table('platform_rule_requests as q')->join('tenants as t', 't.id', '=', 'q.tenant_id')
            ->orderByRaw("case q.status when 'enviado' then 0 when 'en_evaluacion' then 1 else 2 end")->orderByDesc('q.created_at')
            ->get(['q.id', 'q.code', 'q.rule_code', 'q.rule_name', 'q.expected', 'q.trigger_when', 'q.example', 'q.status', 'q.decision_reason', 'q.linked_rule_code', 'q.requested_by_name', 'q.decided_by_name', 'q.decided_at', 'q.lock_version', 'q.created_at', 't.code as tenant_code', 't.commercial_name']);

        return [
            'items' => $rows->map(fn (object $row): array => [
                'code' => $row->code,
                'tenant' => ['code' => $row->tenant_code, 'name' => $row->commercial_name],
                'rule' => ['code' => $row->rule_code, 'name' => $row->rule_name],
                'expected' => $row->expected,
                'trigger_when' => $row->trigger_when,
                'example' => $row->example,
                'status' => $row->status,
                'status_label' => RuleAutomationRequests::STATUSES[$row->status] ?? $row->status,
                'reason' => $row->decision_reason,
                'linked_rule' => $row->linked_rule_code,
                'requested_by' => $row->requested_by_name,
                'decided_by' => $row->decided_by_name,
                'decided_at' => $row->decided_at,
                'requested_at' => $row->created_at,
                'lock_version' => (int) $row->lock_version,
            ])->values()->all(),
            'counts' => collect(RuleAutomationRequests::STATUSES)->map(fn (string $label, string $status): int => $rows->where('status', $status)->count())->all(),
            'standard_rules' => $this->db()->table('sys_booking_rule_catalog')->orderBy('rule_group')->orderBy('name')->get(['code', 'name', 'rule_group as group'])->map(fn (object $rule): array => (array) $rule)->all(),
        ];
    }

    public function decide(string $code, string $decision, ?string $reason, ?string $linkedRule, ?int $version, PlatformUser $actor): array
    {
        $status = self::DECISIONS[$decision] ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'La decisión no es válida.', ['field' => 'decision']);

        $request = $this->db()->transaction(function () use ($code, $status, $reason, $linkedRule, $version, $actor): object {
            $request = $this->db()->table('platform_rule_requests')->where('code', $code)->lockForUpdate()->first() ?? throw ApiException::notFound('El pedido no existe.');

            if ($version !== null) {
                IfMatch::assertMatches($version, (int) $request->lock_version, 'El pedido');
            }

            if (! in_array($request->status, RuleAutomationRequests::OPEN, true)) {
                throw ApiException::conflict('CR-05', 'El pedido ya fue resuelto: '.mb_strtolower(RuleAutomationRequests::STATUSES[$request->status]).'.');
            }

            if ($status === 'en_evaluacion' && $request->status === 'en_evaluacion') {
                throw ApiException::conflict('CR-05', 'El pedido ya está en evaluación.');
            }

            if ($status === 'rechazado' && trim((string) $reason) === '') {
                throw ApiException::unprocessable('VALIDATION_ERROR', 'Indica el motivo del rechazo: la agencia lo verá.', ['field' => 'reason']);
            }

            if ($status === 'publicado' && ($linkedRule === null || ! $this->db()->table('sys_booking_rule_catalog')->where('code', $linkedRule)->exists())) {
                throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige la regla estándar del catálogo que cubre este pedido.', ['field' => 'linked_rule']);
            }

            $this->db()->table('platform_rule_requests')->where('id', $request->id)->update([
                'status' => $status,
                'decision_reason' => $reason !== null && trim($reason) !== '' ? trim($reason) : $request->decision_reason,
                'linked_rule_code' => $status === 'publicado' ? $linkedRule : null,
                'decided_by' => $actor->getKey(),
                'decided_by_name' => mb_substr((string) $actor->name, 0, 160),
                'decided_at' => $status === 'en_evaluacion' ? null : now(),
                'lock_version' => DB::raw('lock_version + 1'),
            ]);
            $this->session->log('Pedido de regla', $request->code, $status, RuleAutomationRequests::STATUSES[$request->status], RuleAutomationRequests::STATUSES[$status].($status === 'publicado' ? " · {$linkedRule}" : '').($reason ? ' · '.mb_substr(trim($reason), 0, 160) : ''), $actor);

            return $this->db()->table('platform_rule_requests')->where('id', $request->id)->first();
        });

        $this->notify($request);

        return collect($this->overview()['items'])->firstWhere('code', $code) ?? [];
    }

    private function notify(object $request): void
    {
        $subject = match ($request->status) {
            'en_evaluacion' => "Estamos evaluando tu pedido para «{$request->rule_name}»",
            'rechazado' => "Tu pedido para «{$request->rule_name}» no se automatizará",
            default => "«{$request->rule_name}» ya tiene efecto automático",
        };
        $body = match ($request->status) {
            'en_evaluacion' => "El equipo de KipuControl revisa el pedido {$request->code}. Te avisaremos cuando esté resuelto.",
            'rechazado' => "Motivo: {$request->decision_reason}",
            default => "Publicamos la regla estándar {$request->linked_rule_code}. Tu regla personalizada quedó enlazada a ella; actívala desde Reglas si tu plan la incluye.",
        };

        $previous = $this->context->id();

        try {
            $this->tenants->run((string) $request->tenant_id, function () use ($request, $subject, $body): void {
                app(StaffNotices::class)->toRoles(['tenant_admin'], 'regla.automatizacion', $subject, $body, 'Regla de reserva', (string) $request->id, null, array_filter([$request->requested_by]));
                RuleResolver::invalidate((string) $request->tenant_id);
            });
        } finally {
            $previous === null ? $this->context->clear() : $this->context->set($previous);
        }
    }

    private function db(): ConnectionInterface
    {
        return DB::connection(self::CONNECTION);
    }
}
