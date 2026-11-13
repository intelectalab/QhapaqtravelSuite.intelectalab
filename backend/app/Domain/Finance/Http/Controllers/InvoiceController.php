<?php

declare(strict_types=1);

namespace App\Domain\Finance\Http\Controllers;

use App\Domain\Finance\Actions\InvoiceFollowUp;
use App\Domain\Finance\Actions\IssueCreditNote;
use App\Domain\Finance\Actions\IssueInvoice;
use App\Domain\Finance\Actions\QueryFiscalStatus;
use App\Domain\Finance\Http\Controllers\Concerns\ResolvesActor;
use App\Domain\Finance\Support\InvoiceDirectory;
use App\Domain\Finance\Support\InvoiceRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

final class InvoiceController
{
    use ResolvesActor;

    public function index(Request $request, InvoiceDirectory $directory): JsonResponse
    {
        return response()->json($directory->list($this->actor($request), $request));
    }

    public function summary(InvoiceDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->summary()]);
    }

    public function show(Request $request, string $number, InvoiceDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->find($number, $this->actor($request))]);
    }

    public function draft(string $code, InvoiceRules $rules): JsonResponse
    {
        return response()->json(['data' => $rules->draft($code)]);
    }

    public function validateDraft(Request $request, InvoiceRules $rules): JsonResponse
    {
        $data = $this->issueData($request);

        return response()->json(['data' => $rules->check($data, $rules->receivable((string) $data['receivable_id']))]);
    }

    public function store(Request $request, IssueInvoice $issue, IssueCreditNote $credit): JsonResponse
    {
        if ($request->input('doc_type') === '07') {
            $data = $request->validate([
                'ref_invoice_id' => ['required', 'string', 'max:40'],
                'credit_note_reason_code' => ['required', Rule::in(array_keys(InvoiceDirectory::CREDIT_REASONS))],
                'credit_note_reason' => ['nullable', 'string', 'max:255'],
                'amount' => ['nullable', 'numeric', 'gt:0'],
            ], [
                'ref_invoice_id.*' => 'Indica el comprobante que modifica.',
                'credit_note_reason_code.*' => 'Elige el motivo de la nota de crédito.',
                'amount.*' => 'El importe debe ser mayor que cero.',
            ]);
            $number = $credit((string) $data['ref_invoice_id'], ['reason_code' => $data['credit_note_reason_code'], 'amount' => $data['amount'] ?? null, 'detail' => $data['credit_note_reason'] ?? null], $this->actor($request));

            return response()->json(['data' => DB::table('fin_invoices')->where('number', $number)->first(['number', 'doc_type', 'status', 'currency', 'total_amount', 'issue_date'])], 202);
        }

        return response()->json(['data' => $issue($this->issueData($request), $this->actor($request))], 202);
    }

    public function statusCheck(Request $request, string $number, QueryFiscalStatus $query): JsonResponse
    {
        return response()->json(['data' => ['number' => $number, 'status' => $query($number, $this->actor($request))]]);
    }

    public function resend(Request $request, string $number, InvoiceFollowUp $followUp): JsonResponse
    {
        $data = $request->validate([
            'description' => ['nullable', 'string', 'min:3', 'max:500'],
            'fx_rate' => ['nullable', 'numeric', 'gt:0', 'lt:100'],
        ], ['description.*' => 'Revisa la descripción.', 'fx_rate.*' => 'Revisa el tipo de cambio.']);

        return response()->json(['data' => $followUp->resend($number, $data, $this->actor($request))]);
    }

    public function deliver(Request $request, string $number, InvoiceFollowUp $followUp): JsonResponse
    {
        $data = $request->validate(['email' => ['nullable', 'email', 'max:150']], ['email.*' => 'Revisa el correo.']);

        return response()->json(['data' => $followUp->deliver($number, $data['email'] ?? null, $this->actor($request))]);
    }

    public function xml(Request $request, string $number, InvoiceFollowUp $followUp): JsonResponse
    {
        return response()->json(['data' => $followUp->fiscalFile($number, 'xml', $this->actor($request))]);
    }

    public function cdr(Request $request, string $number, InvoiceFollowUp $followUp): JsonResponse
    {
        return response()->json(['data' => $followUp->fiscalFile($number, 'cdr', $this->actor($request))]);
    }

    public function void(Request $request, string $number, InvoiceFollowUp $followUp): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:100']], ['reason.*' => 'Explica el motivo de la baja (5 a 100 caracteres).']);

        return response()->json(['data' => $followUp->void($number, $data['reason'], $this->actor($request))]);
    }

    private function issueData(Request $request): array
    {
        return $request->validate([
            'receivable_id' => ['required', 'string', 'max:40'],
            'doc_type' => ['required', Rule::in(InvoiceRules::ISSUABLE)],
            'customer_doc_type' => ['required', Rule::in(InvoiceRules::DOC_TYPES)],
            'customer_doc_number' => ['required', 'string', 'max:20'],
            'customer_name' => ['required', 'string', 'max:200'],
            'customer_address' => ['nullable', 'string', 'max:255'],
            'domiciled' => ['required', 'boolean'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'fx_rate' => ['nullable', 'numeric', 'gt:0', 'lt:100'],
            'description' => ['required', 'string', 'min:3', 'max:500'],
        ], [
            'receivable_id.*' => 'Elige la cuenta por cobrar.',
            'doc_type.*' => 'Elige factura o boleta.',
            'customer_doc_type.*' => 'Elige el tipo de documento del cliente.',
            'customer_doc_number.*' => 'Escribe el número de documento.',
            'customer_name.*' => 'Escribe la razón social o el nombre.',
            'domiciled.*' => 'Indica si el cliente está domiciliado en el Perú.',
            'amount.*' => 'El importe debe ser mayor que cero.',
            'fx_rate.*' => 'Revisa el tipo de cambio.',
            'description.*' => 'Escribe la descripción del servicio.',
        ]);
    }
}
