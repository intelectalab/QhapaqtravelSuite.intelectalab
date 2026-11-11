<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Crm\Support\SalesTargetDirectory;
use App\Domain\Crm\Support\TargetPeriod;
use App\Domain\Finance\Support\FinanceHistory;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Mail\QueuedMail;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Sequences\SequenceService;
use App\Domain\Shared\Tenancy\TenantContext;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class TargetBonusCommission
{
    public function __construct(
        private readonly SequenceService $sequences,
        private readonly SalesTargetDirectory $targets,
        private readonly AuditLogger $audit,
        private readonly QueuedMail $mail,
        private readonly TenantContext $context,
    ) {}

    public function create(string $targetId, ?string $actorId): ?string
    {
        $target = DB::table('crm_sales_targets')->where('id', $targetId)->lockForUpdate()->first();
        $result = $target?->result ? json_decode((string) $target->result, true) : null;

        if ($target === null || $target->status !== 'cerrada' || $target->scope_type !== 'asesor' || ! is_array($result) || (float) $target->goal_sales_pen <= 0 || (float) ($target->bonus_amount ?? 0) <= 0) {
            return null;
        }

        if (DB::table('fin_commissions')->where('sales_target_id', $target->id)->exists()) {
            return null;
        }

        $sales = Decimal::money($result['sales'] ?? 0);
        $achieved = round($sales->toFloat() / (float) $target->goal_sales_pen * 100, 1);
        $tier = collect($this->targets->policy()['tiers'])->filter(fn (array $tier): bool => $achieved >= (float) $tier['min'])->sortByDesc('min')->first();

        if ($tier === null) {
            return null;
        }

        $base = Decimal::money($target->bonus_amount);
        $amount = $base->multipliedBy((string) $tier['pay'])->dividedBy(100, 2, RoundingMode::HALF_UP);

        if (! $amount->isPositive() || ! $sales->isPositive()) {
            return null;
        }

        $pct = BigDecimal::min($amount->multipliedBy(100)->dividedBy($sales, 2, RoundingMode::HALF_UP), BigDecimal::of('999.99'));
        $description = "Bono por meta {$target->code} (".TargetPeriod::label((string) $target->period_key).') · cumplimiento '.number_format($achieved, 1, ',', '.')." % → tramo ≥ {$tier['min']} %: {$tier['pay']} % del bono de ".Decimal::display($base, 'PEN');
        $code = $this->sequences->next('commission');
        $id = (string) DB::table('fin_commissions')->insertGetId([
            'code' => $code,
            'reservation_id' => null,
            'sales_target_id' => $target->id,
            'kind' => 'Bono por meta',
            'beneficiary_user_id' => $target->scope_id,
            'rule_description' => mb_substr($description, 0, 255),
            'base_amount' => (string) $sales,
            'pct' => (string) $pct,
            'amount' => (string) $amount,
            'currency' => 'PEN',
            'status' => 'calculada',
            'created_by' => $actorId,
            'updated_by' => $actorId,
        ], 'id');

        DB::table('crm_sales_targets')->where('id', $target->id)->update(['bonus_commission_id' => $id, 'updated_at' => now()]);
        $actor = $actorId !== null ? User::query()->find($actorId) : null;
        FinanceHistory::record('commission', $id, 'calculada', $description, $actor);

        if ($actorId !== null) {
            DB::table('crm_sales_target_adjustments')->insert([
                'id' => (string) Str::uuid7(),
                'target_id' => $target->id,
                'action' => 'bono',
                'reason' => 'Bono de '.Decimal::display($amount, 'PEN')." enviado a Comisiones ({$code})",
                'actor_id' => $actorId,
                'occurred_at' => now(),
            ]);
        }

        $this->audit->log('Comisión', $code, 'calcular', null, "Bono por meta {$target->code} · ".Decimal::display($amount, 'PEN'));
        $this->notifyFinance($code, (string) $target->scope_id, $amount);

        return $code;
    }

    private function notifyFinance(string $code, string $advisorId, BigDecimal $amount): void
    {
        $advisor = (string) DB::table('iam_users')->where('id', $advisorId)->value('name');
        $recipients = DB::table('iam_users as u')->join('model_has_roles as m', fn ($join) => $join->on('m.model_id', '=', 'u.id'))->join('roles as r', 'r.id', '=', 'm.role_id')
            ->where('r.name', 'finance')->whereNull('u.deleted_at')->where('u.status', 'activo')->whereNotNull('u.email')->distinct()->get(['u.email', 'u.name']);

        foreach ($recipients as $user) {
            $this->mail->send((string) $user->email, (string) $user->name, "Bono por meta {$code} por aprobar", "Hola {$user->name}:\n\nSe cerró la meta de {$advisor} y se generó la comisión {$code} «Bono por meta» por ".Decimal::display($amount, 'PEN').". Revísala y apruébala en Finanzas › Comisiones.\n\n{$this->context->tenant()->commercial_name}");
        }
    }
}
