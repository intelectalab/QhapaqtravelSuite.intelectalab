<?php

declare(strict_types=1);

namespace App\Domain\Finance\Http\Controllers;

use App\Domain\Finance\Actions\PayableWorkflow;
use App\Domain\Finance\Http\Controllers\Concerns\ResolvesActor;
use App\Domain\Finance\Support\FinanceDetails;
use App\Domain\Finance\Support\PayableDirectory;
use App\Domain\Finance\Support\ProfitabilityReport;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Http\CursorPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PayableController
{
    use ResolvesActor;

    private const MESSAGES = [
        'reservation.*' => 'Elige la reserva.',
        'provider.*' => 'Elige el proveedor.',
        'cost_type.*' => 'Elige el tipo de costo.',
        'concept.*' => 'Describe el concepto (hasta 255 caracteres).',
        'amount.*' => 'El importe debe ser mayor que cero.',
        'currency.*' => 'Elige la moneda.',
        'fx_rate.*' => 'El tipo de cambio debe estar entre 0.5 y 20.',
        'due_date.*' => 'Revisa la fecha de vencimiento.',
        'supplier_doc.*' => 'El documento del proveedor admite hasta 30 caracteres.',
        'evidence.*' => 'El sustento admite hasta 1000 caracteres.',
        'method.*' => 'Elige la forma de pago.',
        'paid_on.*' => 'Indica una fecha de pago válida, no futura.',
        'operation_ref.*' => 'Indica el número de operación.',
    ];

    public function index(Request $request, PayableDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->actor($request))]);
    }

    public function summary(Request $request, PayableDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->summary($this->actor($request))]);
    }

    public function byProvider(Request $request, PayableDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->byProvider($this->actor($request))]);
    }

    public function bankAccounts(Request $request): JsonResponse
    {
        $filters = CursorPage::filters($request);

        if (isset($filters['currency']) && ! in_array($filters['currency'], ['PEN', 'USD'], true)) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'La moneda debe ser PEN o USD.', ['filter.currency' => ['La moneda debe ser PEN o USD.']]);
        }

        return response()->json(CursorPage::respond(
            $request,
            FinanceDetails::bankAccountQuery($filters['currency'] ?? null)->select(['code', 'name', 'bank', 'currency', 'account_number']),
            ['code' => 'code', 'name' => 'name', 'currency' => 'currency'],
            'code',
            fn (object $row): array => ['code' => $row->code, 'name' => $row->name, 'bank' => $row->bank, 'currency' => $row->currency, 'account_number' => $row->account_number, 'label' => "{$row->name} · {$row->currency}"],
        ));
    }

    public function preview(Request $request, ProfitabilityReport $report): JsonResponse
    {
        $data = $request->validate([
            'reservation_id' => ['required', 'string', 'max:30'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'currency' => ['required', 'in:PEN,USD'],
            'fx_rate' => ['nullable', 'numeric', 'gt:0.5', 'lt:20'],
        ], ['reservation_id.*' => 'Elige la reserva.', ...self::MESSAGES]);
        $impact = $report->costImpact($data['reservation_id'], (string) $data['amount'], $data['currency'], isset($data['fx_rate']) ? (string) $data['fx_rate'] : null);

        if (! $this->actor($request)->can('finance.profitability')) {
            $impact = ['reservation' => $impact['reservation'], 'amount_pen' => $impact['amount_pen'], 'before' => null, 'after' => null, 'margin_visible' => false];
        }

        return response()->json(['data' => $impact]);
    }

    public function store(Request $request, PayableWorkflow $workflow): JsonResponse
    {
        $actor = $this->actor($request);
        $this->requireOperator($actor);
        $data = $request->validate([
            'reservation' => ['required', 'string', 'max:30'],
            'provider' => ['required', 'string', 'max:30'],
            'cost_type' => ['required', 'in:'.implode(',', PayableWorkflow::costTypes())],
            'concept' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'currency' => ['required', 'in:PEN,USD'],
            'fx_rate' => ['nullable', 'numeric', 'gt:0.5', 'lt:20'],
            'due_date' => ['nullable', 'date'],
            'supplier_doc' => ['nullable', 'string', 'max:30'],
            'evidence' => ['nullable', 'string', 'max:1000'],
        ], self::MESSAGES);

        return response()->json(['data' => ['code' => $workflow->createCost($data, $actor)]], 201);
    }

    public function update(Request $request, string $code, PayableWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'reservation' => ['sometimes', 'string', 'max:30'],
            'provider' => ['sometimes', 'string', 'max:30'],
            'cost_type' => ['sometimes', 'in:'.implode(',', PayableWorkflow::costTypes())],
            'currency' => ['sometimes', 'in:PEN,USD'],
            'fx_rate' => ['nullable', 'numeric', 'gt:0.5', 'lt:20'],
            'concept' => ['required', 'string', 'max:255'],
            'amount' => ['nullable', 'numeric', 'gt:0'],
            'due_date' => ['required', 'date'],
            'supplier_doc' => ['nullable', 'string', 'max:30'],
            'evidence' => ['nullable', 'string', 'max:1000'],
            'lock_version' => ['nullable', 'integer'],
        ], self::MESSAGES);
        $lock = isset($data['lock_version']) ? (int) $data['lock_version'] : null;
        unset($data['lock_version']);
        $workflow->update($code, array_filter($data, fn ($value) => $value !== null), $this->actor($request), $lock);

        return response()->json(['data' => ['code' => $code]]);
    }

    public function schedule(Request $request, string $code, PayableWorkflow $workflow): JsonResponse
    {
        $actor = $this->actor($request);
        $this->requireOperator($actor);
        $data = $request->validate([
            'scheduled_date' => ['required', 'date', 'after_or_equal:today'],
            'bank_account' => ['required', 'string', 'max:20'],
            'lock_version' => ['nullable', 'integer'],
        ], ['scheduled_date.*' => 'La fecha programada no puede ser pasada.', 'bank_account.*' => 'Elige la cuenta de origen.']);
        $workflow->schedule($code, $data, isset($data['lock_version']) ? (int) $data['lock_version'] : null, $actor);

        return response()->json(['data' => ['code' => $code]]);
    }

    public function approve(Request $request, string $code, PayableWorkflow $workflow): JsonResponse
    {
        return response()->json(['data' => ['code' => $code, 'warnings' => $workflow->approve($code, $this->actor($request))]]);
    }

    public function pay(Request $request, string $code, PayableWorkflow $workflow): JsonResponse
    {
        $actor = $this->actor($request);
        $this->requireOperator($actor);
        $data = $request->validate([
            'method' => ['required', 'in:'.implode(',', array_keys(PayableDirectory::PAYOUT_METHODS))],
            'amount' => ['required', 'numeric', 'gt:0'],
            'paid_on' => ['required', 'date', 'before_or_equal:today'],
            'operation_ref' => ['required', 'string', 'max:80'],
            'fx_rate' => ['nullable', 'numeric', 'gt:0.5', 'lt:20'],
            'bank_account' => ['nullable', 'string', 'max:20'],
        ], self::MESSAGES);

        return response()->json(['data' => ['payout' => $workflow->pay($code, $data, $actor)]], 201);
    }

    public function cancel(Request $request, string $code, PayableWorkflow $workflow): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']], ['reason.*' => 'Explica el motivo de la anulación (mínimo 5 caracteres).']);
        $workflow->cancel($code, $data['reason'], $this->actor($request));

        return response()->json(['data' => ['code' => $code]]);
    }
}
