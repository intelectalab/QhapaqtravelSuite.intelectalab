<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Finance\Support\FinanceHistory;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class SupplierInvoiceReview
{
    public const DIFFERENCE_TOLERANCE = 0.01;

    public function __construct(private readonly AuditLogger $audit) {}

    public function validate(string $payableCode, ?string $note, User $actor): void
    {
        DB::transaction(function () use ($payableCode, $note, $actor): void {
            [$payable, $invoice] = $this->open($payableCode);

            if (abs((float) $invoice->amount_difference) > self::DIFFERENCE_TOLERANCE && trim((string) $note) === '') {
                throw ApiException::unprocessable('SUP-BR-41', 'La factura no coincide con el saldo de la cuenta por pagar. Explica por qué la validas.');
            }

            $this->decide($payable, $invoice, 'validada', $note, $actor);
        });
    }

    public function observe(string $payableCode, string $note, User $actor): void
    {
        DB::transaction(function () use ($payableCode, $note, $actor): void {
            [$payable, $invoice] = $this->open($payableCode);
            $this->decide($payable, $invoice, 'observada', $note, $actor);
        });
    }

    private function decide(object $payable, object $invoice, string $status, ?string $note, User $actor): void
    {
        DB::table('supplier_invoices')->where('id', $invoice->id)->update([
            'status' => $status,
            'validated_by' => $actor->getKey(),
            'validated_at' => now(),
            'validation_note' => $note,
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);

        if ($status === 'observada') {
            DB::table('fin_payables')->where('id', $payable->id)->where('supplier_doc_number', $invoice->number)->update(['supplier_doc_number' => null, 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        }

        FinanceHistory::record('payable', $payable->id, (string) $payable->status, trim("Factura {$invoice->number} {$status}".($note ? ": {$note}" : '')), $actor);
        $this->audit->log('Cuenta por pagar', $payable->code, $status === 'validada' ? 'validar_factura_proveedor' : 'observar_factura_proveedor', 'registrada', trim("{$invoice->number} · {$status}".($note ? " · {$note}" : '')));
    }

    private function open(string $payableCode): array
    {
        $payable = DB::table('fin_payables')->where('code', $payableCode)->whereNull('deleted_at')->lockForUpdate()->first() ?? throw ApiException::notFound('La cuenta por pagar no existe.');
        $invoice = DB::table('supplier_invoices')->where('payable_id', $payable->id)->whereNull('deleted_at')
            ->orderByRaw("case when status = 'registrada' then 0 else 1 end")->orderByDesc('uploaded_at')->lockForUpdate()->first()
            ?? throw ApiException::notFound('Esta cuenta por pagar no tiene una factura del proveedor por revisar.');

        if ($invoice->status !== 'registrada') {
            throw ApiException::conflict('APR-BR-08', 'La factura ya fue revisada.');
        }

        if ($payable->status === 'cancelada') {
            throw ApiException::conflict('APR-BR-08', 'La cuenta por pagar está anulada.');
        }

        return [$payable, $invoice];
    }
}
