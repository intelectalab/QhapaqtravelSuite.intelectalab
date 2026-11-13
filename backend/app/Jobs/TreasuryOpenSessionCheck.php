<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Crm\Support\Advisors;
use App\Jobs\Concerns\NotifiesStaff;
use Illuminate\Support\Facades\DB;

final class TreasuryOpenSessionCheck extends TenantJob
{
    use NotifiesStaff;

    public const QUEUE = 'low';

    protected function run(): string
    {
        $today = $this->today()->toDateString();
        $closed = DB::table('fin_treasury_accounts as a')->whereNull('a.deleted_at')->where('a.kind', 'petty_cash')->where('a.status', 'active')
            ->whereNotExists(fn ($query) => $query->from('fin_cash_sessions as s')->whereColumn('s.account_id', 'a.id')->where('s.session_date', $today))
            ->orderBy('a.code')->get(['a.id', 'a.name', 'a.custodian_id']);

        if ($closed->isEmpty()) {
            return 'Todas las cajas chicas se abrieron hoy';
        }

        $finance = app(Advisors::class)->all(['finance'])->pluck('id')->map(fn (mixed $id): string => (string) $id);
        $sent = 0;

        foreach ($closed as $account) {
            foreach ($finance->merge([(string) $account->custodian_id])->filter()->unique() as $userId) {
                $sent += $this->notifyOnce('caja.sin_abrir', $userId, 'fin_treasury_account', (string) $account->id, "{$account->name} no se abrió hoy", 'Sin apertura no se pueden registrar gastos ni recibir efectivo (TES-BR-05). Ábrela con el conteo del último cierre.', true) ? 1 : 0;
            }
        }

        return $this->warn(self::plural($closed->count(), 'caja sin abrir', 'cajas sin abrir').' · '.self::plural($sent, 'aviso', 'avisos'));
    }
}
