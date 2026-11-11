<?php

declare(strict_types=1);

namespace App\Domain\SupplierPortal\Actions;

use App\Domain\Finance\Support\ReceivableLedger;
use App\Domain\Integrations\Support\AttachmentGuard;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\SupplierPortal\Support\SupplierAccount;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class SupplierInvoices
{
    public const MAX_BYTES = 700 * 1024;

    public const MIME = ['pdf' => 'application/pdf', 'xml' => 'application/xml', 'zip' => 'application/zip'];

    public function __construct(private readonly AuditLogger $audit, private readonly TenantContext $context, private readonly AttachmentGuard $guard) {}

    public function register(SupplierAccount $account, string $payableCode, array $data): array
    {
        $bytes = base64_decode((string) $data['file_content'], true);

        if ($bytes === false || $bytes === '') {
            throw ApiException::unprocessable('SUP-BR-40', 'Adjunte el archivo de la factura (PDF, XML o ZIP).');
        }

        if (strlen($bytes) > self::MAX_BYTES) {
            throw ApiException::unprocessable('SUP-BR-40', 'El archivo supera los 700 KB. Adjunte el XML o un PDF más liviano.');
        }

        $this->guard->ensureClean($bytes, (string) $data['file_name'], 'Factura de proveedor', $payableCode);
        $extension = Str::lower(pathinfo((string) $data['file_name'], PATHINFO_EXTENSION));
        $number = Str::upper(trim((string) $data['number']));
        $path = null;

        try {
            return DB::transaction(function () use ($account, $payableCode, $data, $bytes, $extension, $number, &$path): array {
                $payable = $account->payable($payableCode);
                DB::table('fin_payables')->where('id', $payable->id)->lockForUpdate()->first(['id']);
                $balance = ReceivableLedger::balance($payable);

                if ($payable->status === 'pagada' || ! $balance->isPositive()) {
                    throw ApiException::conflict('SUP-BR-42', 'Este documento ya está pagado; no necesita factura.');
                }

                if ($this->active($payable->id) !== null) {
                    throw ApiException::conflict('SUP-BR-42', 'Ya registró una factura para este documento. Anúlela si necesita reemplazarla.');
                }

                $previous = DB::table('supplier_invoices')->where('provider_id', $account->id())->where('number', $number)->first(['id', 'deleted_at']);

                if ($previous !== null && $previous->deleted_at === null) {
                    throw ApiException::conflict('SUP-BR-40', "La factura {$number} ya fue registrada.");
                }

                $path = "tenants/{$this->context->idOrFail()}/supplier/invoices/".Str::uuid7().".{$extension}";
                Storage::disk((string) config('filesystems.default'))->put($path, $bytes);
                $documentId = (string) DB::table('sys_documents')->insertGetId([
                    'doc_type' => 'factura_proveedor',
                    'entity_type' => 'fin_payables',
                    'entity_id' => $payable->id,
                    'storage_disk' => (string) config('filesystems.default'),
                    'storage_path' => $path,
                    'file_name' => Str::limit((string) $data['file_name'], 200, ''),
                    'mime_type' => self::MIME[$extension],
                    'size_bytes' => strlen($bytes),
                    'sha256' => hash('sha256', $bytes),
                    'created_by' => $account->user->getKey(),
                ], 'id');
                $amount = Decimal::money($data['amount']);
                $difference = (string) $amount->minus($balance);
                $values = [
                    'payable_id' => $payable->id,
                    'issue_date' => $data['issue_date'],
                    'amount' => (string) $amount,
                    'currency' => $payable->currency,
                    'amount_difference' => $difference,
                    'document_id' => $documentId,
                    'original_file_name' => Str::limit((string) $data['file_name'], 200, ''),
                    'status' => 'registrada',
                    'uploaded_by' => $account->user->getKey(),
                    'uploaded_at' => now(),
                    'validated_by' => null,
                    'validated_at' => null,
                    'validation_note' => null,
                    'deleted_at' => null,
                    'updated_by' => $account->user->getKey(),
                    'updated_at' => now(),
                ];
                $previous !== null
                    ? DB::table('supplier_invoices')->where('id', $previous->id)->update($values)
                    : DB::table('supplier_invoices')->insert([...$values, 'provider_id' => $account->id(), 'number' => $number, 'created_by' => $account->user->getKey()]);
                DB::table('fin_payables')->where('id', $payable->id)->update(['supplier_doc_number' => $number, 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $account->user->getKey(), 'updated_at' => now()]);
                $this->audit->log('Cuenta por pagar', $payable->code, 'factura_proveedor', $payable->supplier_doc_number, "{$number} ({$data['file_name']})");

                return ['number' => $number, 'difference' => Decimal::of($difference)->abs()->isGreaterThan('0.01') ? (float) $difference : 0.0];
            });
        } catch (\Throwable $exception) {
            if ($path !== null) {
                Storage::disk((string) config('filesystems.default'))->delete($path);
            }

            throw $exception;
        }
    }

    public function annul(SupplierAccount $account, string $payableCode): void
    {
        DB::transaction(function () use ($account, $payableCode): void {
            $payable = $account->payable($payableCode);
            $invoice = $this->active($payable->id) ?? throw ApiException::notFound('Este documento no tiene una factura registrada.');

            if ($invoice->status !== 'registrada') {
                throw ApiException::conflict('SUP-BR-42', 'Finanzas ya validó esta factura. Para cambios escriba a Pagos de la agencia.');
            }

            DB::table('supplier_invoices')->where('id', $invoice->id)->update(['deleted_at' => now(), 'updated_by' => $account->user->getKey(), 'updated_at' => now()]);
            DB::table('fin_payables')->where('id', $payable->id)->where('supplier_doc_number', $invoice->number)->update(['supplier_doc_number' => null, 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $account->user->getKey(), 'updated_at' => now()]);
            $this->audit->log('Cuenta por pagar', $payable->code, 'anular_factura_proveedor', $invoice->number, null);
        });
    }

    private function active(string $payableId): ?object
    {
        return DB::table('supplier_invoices')->where('payable_id', $payableId)->whereIn('status', ['registrada', 'validada'])->whereNull('deleted_at')->first();
    }
}
