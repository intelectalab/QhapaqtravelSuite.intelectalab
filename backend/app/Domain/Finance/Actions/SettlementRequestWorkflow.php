<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Finance\Support\FinanceHistory;
use App\Domain\Iam\Models\User;
use App\Domain\Inbox\Support\OriginClosure;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class SettlementRequestWorkflow
{
    public function __construct(private readonly CommissionWorkflow $commissions, private readonly OriginClosure $origin, private readonly AuditLogger $audit) {}

    public function approve(string $code, ?string $note, User $actor): int
    {
        return DB::transaction(function () use ($code, $note, $actor): int {
            $request = $this->open($code);
            $rows = $this->commissions($request);

            if ($rows->isEmpty()) {
                throw ApiException::conflict('FIN-BR-28', 'Las comisiones de esta liquidación ya no están vigentes.');
            }

            $approved = 0;
            foreach ($rows->where('status', 'calculada') as $commission) {
                $this->commissions->approve($commission->code, $actor);
                $this->origin->close('fin_commissions', $commission->code, true, "Aprobada con la liquidación {$request->code}", $actor);
                $approved++;
            }

            DB::table('channel_b2b_settlement_requests')->where('id', $request->id)->update(['status' => 'aprobada', 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Liquidación de comisiones', $request->code, 'aprobar', 'solicitada', trim("aprobada · {$rows->count()} comisiones · PEN {$request->amount_pen}".($note ? " · {$note}" : '')));

            return $approved;
        });
    }

    public function reject(string $code, string $note, User $actor): void
    {
        DB::transaction(function () use ($code, $note, $actor): void {
            $request = $this->open($code);

            foreach ($this->commissions($request) as $commission) {
                DB::table('fin_commissions')->where('id', $commission->id)->update(['settlement_request_id' => null, 'observation' => $note, 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
                FinanceHistory::record('commission', $commission->id, $commission->status, "Liquidación {$request->code} observada: {$note}", $actor);
                $this->audit->log('Comisión', $commission->code, 'observar', $commission->status, $note);
            }

            DB::table('channel_b2b_settlement_requests')->where('id', $request->id)->update(['status' => 'rechazada', 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Liquidación de comisiones', $request->code, 'rechazar', 'solicitada', "rechazada · {$note}");
        });
    }

    private function open(string $code): object
    {
        $request = DB::table('channel_b2b_settlement_requests')->where('code', $code)->lockForUpdate()->first() ?? throw ApiException::notFound('La liquidación no existe.');

        if ($request->status !== 'solicitada') {
            throw ApiException::conflict('APR-BR-08', 'La liquidación ya fue resuelta.');
        }

        return $request;
    }

    private function commissions(object $request): Collection
    {
        $ids = array_values(array_filter(explode(',', trim((string) $request->commission_ids, '{}'))));

        return DB::table('fin_commissions')->whereIn('id', $ids)->whereNull('deleted_at')->get(['id', 'code', 'status']);
    }
}
