<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use Database\Seeders\Modules\Concerns\SeedsFinance;
use Database\Support\KitSeeds;

final class FinancePayablesSeeder
{
    use SeedsFinance;

    public function run(): void
    {
        $movements = collect(KitSeeds::read('treasuryMovements'))->where('srcKind', 'payable')->keyBy('srcId');
        $payout = 1000;

        foreach (array_reverse(KitSeeds::read('payables')) as $seed) {
            $providerId = $this->codeId('catalog_providers', $seed['providerId'], 'ref');
            if ($providerId === null) {
                continue;
            }

            $approver = $this->userId('U07');
            $created = $this->moment($seed['due'].' 09:00');
            $payableId = $this->upsert('fin_payables', ['code' => $seed['id']], [
                'provider_id' => $providerId,
                'reservation_id' => $this->codeId('booking_reservations', $seed['resId']),
                'kind' => 'servicio',
                'concept' => $seed['concept'],
                'amount' => $seed['amount'],
                'currency' => $seed['currency'],
                'fx_rate' => $this->fxFor($seed['currency']),
                'due_date' => $this->day($seed['due']),
                'paid_amount' => $seed['paid'],
                'status' => $seed['status'],
                'approved_at' => $seed['approved'] ? $created : null,
                'approved_by' => $seed['approved'] ? $approver : null,
                'created_by' => $approver,
            ]);

            if ($seed['approved']) {
                $this->history('payable', $payableId, 'aprobada', 'Obligación validada contra el servicio', $approver, $created);
            }

            if ((float) $seed['paid'] > 0) {
                $payout++;
                $movement = $movements->get($seed['id']);
                $this->upsert('fin_payable_payouts', ['payable_id' => $payableId], [
                    'code' => 'PPR-'.$payout,
                    'paid_on' => $this->day($movement['date'] ?? $seed['due']),
                    'amount' => $seed['paid'],
                    'fx_rate' => $this->fxFor($seed['currency']),
                    'method' => 'transferencia',
                    'operation_ref' => $movement['ref'] ?? 'Pago registrado',
                    'created_by' => $approver,
                ]);
                $this->history('payable', $payableId, 'pagada', 'Pago al proveedor registrado', $approver, $this->moment(($movement['date'] ?? $seed['due']).' 11:00'));
            }
        }
    }
}
