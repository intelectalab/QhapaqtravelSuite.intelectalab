<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use Database\Seeders\Modules\Concerns\SeedsFinance;
use Database\Support\KitSeeds;

final class FinanceCommissionsSeeder
{
    use SeedsFinance;

    private const KINDS = ['Vendedor' => 'vendedor', 'Agencia B2B' => 'agencia_b2b', 'Bono por meta' => 'Bono por meta'];

    public function run(): void
    {
        $rules = [
            'directo_ecommerce' => $this->upsert('fin_commission_rules', ['condition' => 'directo_ecommerce'], ['beneficiary_kind' => 'vendedor', 'pct' => 3, 'base_type' => 'neto_sin_igv', 'valid_from' => '2026-01-01', 'active' => true]),
            'corporativo_grupos' => $this->upsert('fin_commission_rules', ['condition' => 'corporativo_grupos'], ['beneficiary_kind' => 'vendedor', 'pct' => 2.5, 'base_type' => 'neto_sin_igv', 'valid_from' => '2026-01-01', 'active' => true]),
            'b2b_convenio' => $this->upsert('fin_commission_rules', ['condition' => 'b2b_convenio'], ['beneficiary_kind' => 'agencia_b2b', 'pct' => null, 'base_type' => 'total', 'valid_from' => '2026-01-01', 'active' => true]),
        ];

        foreach (KitSeeds::read('commissions') as $seed) {
            $kind = self::KINDS[$seed['kind']] ?? 'vendedor';
            $agencyId = $kind === 'agencia_b2b' ? $this->codeId('channel_b2b_agencies', $seed['beneficiary']) : null;
            $userId = $kind === 'agencia_b2b' ? null : $this->actor($seed['beneficiary']);
            $reservationId = $this->codeId('booking_reservations', $seed['resId']);
            $targetId = $kind === 'Bono por meta' ? $this->codeId('crm_sales_targets', $seed['targetId'] ?? null) : null;

            if (($agencyId === null && $userId === null) || ($kind !== 'Bono por meta' && $reservationId === null) || ($kind === 'Bono por meta' && $targetId === null)) {
                continue;
            }

            $ruleKey = $kind === 'agencia_b2b' ? 'b2b_convenio' : ((float) $seed['pct'] === 2.5 ? 'corporativo_grupos' : 'directo_ecommerce');
            $created = $this->moment($seed['createdAt'] ?? '2026-09-15 09:00');
            $approved = in_array($seed['status'], ['aprobada', 'pagada'], true);
            $paid = $seed['status'] === 'pagada';
            $payRef = $seed['payRef'] ?? null;
            $method = $payRef ? trim(explode('·', $payRef)[0]) : ($kind === 'agencia_b2b' ? 'Nota de crédito a cuenta B2B' : 'Planilla del mes');
            $description = $seed['rule'] ?? match ($ruleKey) {
                'b2b_convenio' => "Convenio B2B: {$seed['pct']} % sobre el total de la reserva",
                'corporativo_grupos' => 'Vendedor corporativo o grupos: 2,5 % sobre la venta neta',
                default => 'Vendedor venta directa: 3 % sobre la venta neta',
            };

            $id = $this->upsert('fin_commissions', ['code' => $seed['id']], [
                'reservation_id' => $reservationId,
                'sales_target_id' => $targetId,
                'kind' => $kind,
                'beneficiary_user_id' => $userId,
                'beneficiary_agency_id' => $agencyId,
                'rule_id' => $kind === 'Bono por meta' ? null : $rules[$ruleKey],
                'rule_description' => mb_substr($description, 0, 255),
                'base_amount' => $seed['base'],
                'pct' => $seed['pct'],
                'amount' => $seed['amount'],
                'currency' => $seed['currency'],
                'fx_rate' => $this->fxFor($seed['currency'], isset($seed['fx']) ? (float) $seed['fx'] : null),
                'status' => $seed['status'],
                'approved_at' => $approved ? $this->moment(($seed['createdAt'] ?? '2026-09-16 09:00')) : null,
                'approved_by' => $approved ? $this->userId('U07') : null,
                'paid_at' => $paid ? $this->moment($seed['paidAt'] ?? '2026-09-20 10:00') : null,
                'payment_method' => $paid ? $method : null,
                'payment_ref' => $paid ? ($payRef ? trim(explode('·', $payRef)[1] ?? $payRef) : 'Planilla 2026-09') : null,
                'created_by' => $this->userId('U07'),
                'created_at' => $created,
            ]);

            foreach ($seed['history'] ?? [['ts' => $seed['createdAt'] ?? '2026-09-15 09:00', 'status' => 'calculada', 'user' => 'Sistema', 'note' => $description]] as $entry) {
                $this->history('commission', $id, $entry['status'], $entry['note'] ?: null, $this->actor($entry['user']), $this->moment($entry['ts']));
            }
        }
    }
}
