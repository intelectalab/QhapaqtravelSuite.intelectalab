<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Crm\Support\Advisors;
use App\Jobs\Concerns\NotifiesStaff;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class CashDepositAlerts extends TenantJob
{
    use NotifiesStaff;

    public const QUEUE = 'notifications';

    protected function run(): string
    {
        $hours = (int) (DB::table('fin_treasury_settings')->value('cash_deposit_hours') ?? 24);
        $limit = Carbon::now()->subHours(max(1, $hours));
        $pending = DB::table('fin_treasury_movements as m')->join('fin_treasury_accounts as a', 'a.id', '=', 'm.account_id')
            ->where('a.kind', 'petty_cash')->where('m.type', 'collection')->where('m.direction', 'in')->where('m.status', 'posted')->whereNull('m.deposited_transfer_id')
            ->where('m.created_at', '<=', $limit)
            ->groupBy('a.id', 'a.name')->selectRaw('a.id, a.name, count(*) as total, sum(m.amount) as amount')->get();

        if ($pending->isEmpty()) {
            return 'Sin cobros en efectivo pendientes de depósito';
        }

        $users = app(Advisors::class)->all(['finance'])->pluck('id')->map(fn (mixed $id): string => (string) $id);
        $sent = 0;

        foreach ($pending as $account) {
            foreach ($users as $userId) {
                $sent += $this->notifyOnce('efectivo.sin_depositar', $userId, 'fin_treasury_account', (string) $account->id, "{$account->name}: efectivo sin depositar", "{$account->total} cobro(s) por S/ ".number_format((float) $account->amount, 2)." llevan más de {$hours} h en caja (TES-BR-09). Regístralos con una transferencia de depósito al banco.", true) ? 1 : 0;
            }
        }

        return $this->warn(self::plural($pending->count(), 'caja con efectivo sin depositar', 'cajas con efectivo sin depositar').' · '.self::plural($sent, 'aviso', 'avisos'));
    }
}
