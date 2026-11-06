<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Finance\Support\FinanceHistory;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class QueryFiscalStatus
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function __invoke(string $number, User $actor): string
    {
        return DB::transaction(function () use ($number, $actor): string {
            $invoice = DB::table('fin_invoices')->where('number', $number)->lockForUpdate()->first(['id', 'number', 'status']);

            if ($invoice === null) {
                throw ApiException::notFound('El comprobante no existe.');
            }

            if ($invoice->status !== 'emitido') {
                throw ApiException::conflict('FIN-BR-49', 'Solo se consulta el estado de comprobantes enviados que esperan respuesta.');
            }

            DB::table('fin_invoices')->where('id', $invoice->id)->update([
                'status' => 'aceptado',
                'ose_ticket' => 'TCK-'.substr($invoice->number, -8),
                'ose_response_code' => '0',
                'ose_response_message' => 'Aceptado por el OSE (respuesta simulada)',
                'ose_responded_at' => now(),
                'lock_version' => DB::raw('lock_version + 1'),
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);
            FinanceHistory::record('invoice', $invoice->id, 'aceptado', 'Respuesta OSE simulada', $actor);
            $this->audit->log('Comprobante', $invoice->number, 'respuesta_ose', 'emitido', 'aceptado');

            return 'aceptado';
        });
    }
}
