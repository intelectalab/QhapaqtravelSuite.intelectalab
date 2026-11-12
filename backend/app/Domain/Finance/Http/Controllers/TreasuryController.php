<?php

declare(strict_types=1);

namespace App\Domain\Finance\Http\Controllers;

use App\Domain\Finance\Actions\FxRevaluationWorkflow;
use App\Domain\Finance\Actions\TreasuryMovementWorkflow;
use App\Domain\Finance\Actions\TreasuryOperations;
use App\Domain\Finance\Actions\TreasurySync;
use App\Domain\Finance\Http\Controllers\Concerns\ResolvesActor;
use App\Domain\Finance\Support\CashCountSheet;
use App\Domain\Finance\Support\ExpenseReceiptFiles;
use App\Domain\Finance\Support\TreasuryDirectory;
use App\Domain\Finance\Support\TreasuryRouting;
use App\Domain\Finance\Support\TreasurySettings;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class TreasuryController
{
    use ResolvesActor;

    public function index(Request $request, TreasuryDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->actor($request))]);
    }

    public function store(Request $request, TreasuryMovementWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'account' => ['required', 'string', 'max:20'],
            'direction' => ['required', 'in:in,out'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'date' => ['required', 'date', 'before_or_equal:today'],
            'category' => ['required', 'string', 'max:60'],
            'description' => ['required', 'string', 'max:255'],
            'reference' => ['required', 'string', 'max:80'],
            'counterparty' => ['nullable', 'string', 'max:160'],
        ], [
            'account.*' => 'Elige la cuenta.',
            'direction.*' => 'Indica si es ingreso o egreso.',
            'amount.*' => 'El importe debe ser mayor que cero.',
            'date.*' => 'Indica una fecha válida, no futura.',
            'category.*' => 'Elige la categoría.',
            'description.*' => 'Describe el movimiento (hasta 255 caracteres).',
            'reference.*' => 'Escribe el número de operación (hasta 80 caracteres).',
            'counterparty.*' => 'La contraparte admite hasta 160 caracteres.',
        ]);

        return response()->json(['data' => ['code' => $workflow->record($data, $this->actor($request))]], 201);
    }

    public function ledger(string $code, TreasuryDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->ledger($code) ?? throw ApiException::notFound('La cuenta no existe.')]);
    }

    public function cashFlow(Request $request, TreasuryDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->cashFlow($this->actor($request))]);
    }

    public function storeAccount(Request $request, TreasuryOperations $operations): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', 'in:bank,petty_cash,gateway'],
            'name' => ['required', 'string', 'min:3', 'max:120'],
            'currency' => ['required', 'in:PEN,USD'],
            'opening_balance' => ['nullable', 'numeric', 'gte:0'],
            'opening_date' => ['nullable', 'date', 'before_or_equal:today'],
            ...$this->accountRules(),
            'fund_amount' => ['required_if:kind,petty_cash', 'nullable', 'numeric', 'gt:0'],
            'custodian_id' => ['required_if:kind,petty_cash', 'nullable', 'uuid'],
            'settle_to' => ['required_if:kind,gateway', 'nullable', 'string', 'max:20'],
        ], $this->accountMessages());

        return response()->json(['data' => ['code' => $operations->saveAccount(null, $data, $this->actor($request))]], 201);
    }

    public function updateAccount(Request $request, string $code, TreasuryOperations $operations): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'min:3', 'max:120'],
            ...$this->accountRules(),
            'fund_amount' => ['nullable', 'numeric', 'gt:0'],
            'custodian_id' => ['nullable', 'uuid'],
            'settle_to' => ['nullable', 'string', 'max:20'],
            'active' => ['sometimes', 'boolean'],
        ], $this->accountMessages());

        return response()->json(['data' => ['code' => $operations->saveAccount($code, $data, $this->actor($request))]]);
    }

    public function transfer(Request $request, TreasuryOperations $operations): JsonResponse
    {
        $data = $request->validate([
            'from' => ['required', 'string', 'max:20'],
            'to' => ['required', 'string', 'max:20', 'different:from'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'deal_rate' => ['nullable', 'numeric', 'gt:0', 'lt:20'],
            'date' => ['required', 'date', 'before_or_equal:today'],
            'reference' => ['required', 'string', 'max:80'],
            'description' => ['required', 'string', 'min:3', 'max:255'],
            'cash_deposit' => ['nullable', 'boolean'],
        ], ['to.different' => 'Elige cuentas distintas.', 'amount.*' => 'El importe debe ser mayor que cero.', 'reference.*' => 'Escribe el número de operación.', 'description.*' => 'Describe la transferencia.', 'date.*' => 'Indica una fecha válida, no futura.']);

        return response()->json(['data' => ['code' => $operations->transfer($data, $this->actor($request), ! empty($data['cash_deposit']) ? 'cash_deposit' : 'transfer')]], 201);
    }

    public function settle(Request $request, string $account, TreasuryOperations $operations): JsonResponse
    {
        $data = $request->validate([
            'gross' => ['required', 'numeric', 'gt:0'],
            'fee_pct' => ['nullable', 'numeric', 'gte:0', 'lt:20'],
            'date' => ['required', 'date', 'before_or_equal:today'],
            'batch' => ['required', 'string', 'max:80'],
        ], ['gross.*' => 'Indica el monto bruto del lote.', 'batch.*' => 'Escribe el número de lote de la pasarela.']);

        return response()->json(['data' => ['code' => $operations->settleGateway($account, $data, $this->actor($request))]], 201);
    }

    public function openSession(Request $request, string $account, TreasuryOperations $operations): JsonResponse
    {
        $data = $request->validate(['counted' => ['required', 'numeric', 'gte:0'], 'note' => ['nullable', 'string', 'max:300']], ['counted.*' => 'Indica el efectivo contado al abrir.']);

        return response()->json(['data' => ['code' => $operations->openSession($account, $data, $this->actor($request))]], 201);
    }

    public function expense(Request $request, string $account, TreasuryOperations $operations): JsonResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0'],
            'date' => ['nullable', 'date', 'before_or_equal:today'],
            'category' => ['required', 'string', 'max:60'],
            'description' => ['required', 'string', 'min:3', 'max:255'],
            'receipt_type' => ['required', 'in:invoice,sales_receipt,ticket,fee_receipt,mobility_sheet,sworn_statement'],
            'series_number' => ['required_unless:receipt_type,mobility_sheet,sworn_statement', 'nullable', 'string', 'max:30'],
            'issuer_ruc' => ['required_if:receipt_type,invoice,fee_receipt', 'nullable', 'digits:11'],
            'supplier' => ['required', 'string', 'max:160'],
            'reservation' => ['nullable', 'string', 'max:30'],
            'file' => ['nullable', 'file', 'max:'.ExpenseReceiptFiles::MAX_KB],
        ], ['amount.*' => 'El importe debe ser mayor que cero.', 'series_number.*' => 'Escribe la serie y el número del comprobante.', 'issuer_ruc.*' => 'El RUC del emisor debe tener 11 dígitos.', 'supplier.*' => 'Escribe a quién se le pagó.', 'description.*' => 'Describe el gasto.', 'category.*' => 'Elige la categoría.', 'file.*' => 'Adjunta el comprobante en PDF o imagen de hasta 10 MB.']);

        return response()->json(['data' => ['code' => $operations->expense($account, $data, $this->actor($request), $request->file('file'))]], 201);
    }

    public function receipt(string $code, ExpenseReceiptFiles $files): StreamedResponse
    {
        return $files->download($code);
    }

    public function countSheet(string $code, CashCountSheet $sheet): Response
    {
        return $sheet->response($code);
    }

    public function settings(TreasurySettings $settings): JsonResponse
    {
        return response()->json(['data' => $settings->current()]);
    }

    public function updateSettings(Request $request, TreasurySettings $settings): JsonResponse
    {
        $data = $request->validate([
            'petty_tolerance' => ['sometimes', 'numeric', 'gte:0', 'lte:1000'],
            'max_petty_expense' => ['sometimes', 'numeric', 'gt:0', 'lte:100000'],
            'sworn_statement_max' => ['sometimes', 'numeric', 'gte:0', 'lte:100000'],
            'replenish_threshold_pct' => ['sometimes', 'integer', 'between:1,100'],
            'gateway_fee_pct' => ['sometimes', 'numeric', 'gte:0', 'lt:20'],
            'cash_deposit_hours' => ['sometimes', 'integer', 'between:1,168'],
            'margin_target_pct' => ['sometimes', 'numeric', 'gt:0', 'lte:100'],
            'margin_floor_pct' => ['sometimes', 'numeric', 'gte:0', 'lt:100'],
            'recurring_outflows' => ['sometimes', 'array', 'max:20'],
            'recurring_outflows.*.concept' => ['required', 'string', 'min:3', 'max:120'],
            'recurring_outflows.*.amount' => ['required', 'numeric', 'gt:0', 'lte:10000000'],
            'recurring_outflows.*.day' => ['required', 'integer', 'between:1,28'],
            'payment_routing' => ['sometimes', 'array', 'max:40'],
            'payment_routing.*.method' => ['required', 'string', 'max:40', 'distinct'],
            'payment_routing.*.destination' => ['required', Rule::in(TreasuryRouting::DESTINATIONS)],
            'payment_routing.*.bank' => ['nullable', 'required_if:payment_routing.*.destination,bank', 'string', 'max:40'],
            'payment_routing.*.currency' => ['nullable', 'in:PEN,USD'],
            'lock_version' => ['nullable', 'integer'],
        ], [
            'petty_tolerance.*' => 'La tolerancia del arqueo va de 0 a 1000 soles.',
            'max_petty_expense.*' => 'Indica el máximo por gasto de caja chica.',
            'sworn_statement_max.*' => 'Indica el tope de la declaración jurada.',
            'replenish_threshold_pct.*' => 'El umbral de reposición va de 1 % a 100 %.',
            'gateway_fee_pct.*' => 'La comisión de la pasarela va de 0 % a 20 %.',
            'cash_deposit_hours.*' => 'El plazo de depósito va de 1 a 168 horas.',
            'margin_target_pct.*' => 'La meta de margen va de 1 % a 100 %.',
            'margin_floor_pct.*' => 'El margen mínimo va de 0 % a 99 %.',
            'recurring_outflows.*.concept.*' => 'Describe cada egreso fijo (3 a 120 caracteres).',
            'recurring_outflows.*.amount.*' => 'Cada egreso fijo necesita un monto mayor que cero.',
            'recurring_outflows.*.day.*' => 'El día de pago va del 1 al 28.',
            'payment_routing.*.method.*' => 'Cada medio de pago va una sola vez.',
            'payment_routing.*.destination.*' => 'Elige a qué cuenta llega cada medio de pago.',
            'payment_routing.*.bank.*' => 'Elige el banco que recibe ese medio de pago.',
            'payment_routing.*.currency.*' => 'La moneda de la cuenta es soles, dólares o la del cobro.',
        ]);
        $current = $settings->current();

        if ((float) ($data['sworn_statement_max'] ?? $current['sworn_statement_max']) > (float) ($data['max_petty_expense'] ?? $current['max_petty_expense'])) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'El tope de la declaración jurada no puede superar el máximo por gasto.', ['sworn_statement_max' => ['No puede superar el máximo por gasto.']]);
        }

        if ((float) ($data['margin_floor_pct'] ?? $current['margin_floor_pct']) >= (float) ($data['margin_target_pct'] ?? $current['margin_target_pct'])) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'El margen mínimo debe ser menor que la meta.', ['margin_floor_pct' => ['Debe ser menor que la meta.']]);
        }

        $lock = isset($data['lock_version']) ? (int) $data['lock_version'] : null;
        unset($data['lock_version']);

        return response()->json(['data' => $settings->update($data, $lock, $this->actor($request))]);
    }

    public function revaluationPreview(Request $request, FxRevaluationWorkflow $workflow): JsonResponse
    {
        return response()->json(['data' => $workflow->preview($request->query('close_rate'), $this->actor($request))]);
    }

    public function revalue(Request $request, FxRevaluationWorkflow $workflow): JsonResponse
    {
        $data = $request->validate(['close_rate' => ['required', 'numeric', 'gt:0.5', 'lt:20']], ['close_rate.*' => 'Indica el tipo de cambio de cierre (entre 0.5 y 20).']);

        return response()->json(['data' => ['codes' => $workflow->register((string) $data['close_rate'], $this->actor($request))]], 201);
    }

    public function count(Request $request, string $account, TreasuryOperations $operations): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', 'in:closing,surprise'],
            'denominations' => ['required', 'array'],
            'denominations.*' => ['integer', 'min:0', 'max:100000'],
            'note' => ['nullable', 'string', 'max:500'],
            'witness_id' => ['nullable', 'uuid'],
        ], ['denominations.*' => 'Revisa las cantidades por denominación.']);

        return response()->json(['data' => ['code' => $operations->count($account, $data, $this->actor($request))]], 201);
    }

    public function approveCount(Request $request, string $code, TreasuryOperations $operations): JsonResponse
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:500']]);
        $operations->approveCount($code, $data['note'] ?? null, $this->actor($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function validateCount(Request $request, string $code, TreasuryOperations $operations): JsonResponse
    {
        $operations->validateCount($code, $this->actor($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function requestReplenishment(Request $request, string $account, TreasuryOperations $operations): JsonResponse
    {
        $data = $request->validate(['amount' => ['nullable', 'numeric', 'gt:0'], 'note' => ['nullable', 'string', 'max:500']]);

        return response()->json(['data' => ['code' => $operations->requestReplenishment($account, $data, $this->actor($request))]], 201);
    }

    public function approveReplenishment(Request $request, string $code, TreasuryOperations $operations): JsonResponse
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:500']]);
        $operations->decideReplenishment($code, 'approve', $data['note'] ?? null, $this->actor($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function rejectReplenishment(Request $request, string $code, TreasuryOperations $operations): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']], ['reason.*' => 'Explica por qué se rechaza (mínimo 5 caracteres).']);
        $operations->decideReplenishment($code, 'reject', $data['reason'], $this->actor($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function payReplenishment(Request $request, string $code, TreasuryOperations $operations): JsonResponse
    {
        $data = $request->validate(['from' => ['required', 'string', 'max:20'], 'date' => ['required', 'date', 'before_or_equal:today'], 'reference' => ['required', 'string', 'max:80']], ['from.*' => 'Elige la cuenta bancaria de origen.', 'reference.*' => 'Escribe el número de operación.']);

        return response()->json(['data' => ['code' => $operations->payReplenishment($code, $data, $this->actor($request))]], 201);
    }

    private function accountRules(): array
    {
        return [
            'bank' => ['nullable', 'string', 'max:80'],
            'account_number' => ['nullable', 'string', 'max:40'],
            'cci' => ['nullable', 'digits:20'],
            'sede_id' => ['nullable', 'uuid'],
        ];
    }

    private function accountMessages(): array
    {
        return ['name.*' => 'Escribe el nombre de la cuenta.', 'fund_amount.*' => 'Indica el fondo fijo de la caja.', 'custodian_id.*' => 'Elige quién custodia la caja.', 'settle_to.*' => 'Elige la cuenta bancaria donde liquida la pasarela.', 'cci.*' => 'El CCI tiene 20 dígitos.'];
    }

    public function void(Request $request, string $code, TreasuryMovementWorkflow $workflow): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']], ['reason.*' => 'Explica el motivo de la anulación (mínimo 5 caracteres).']);
        $workflow->void($code, $data['reason'], $this->actor($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function sync(Request $request, TreasurySync $sync): JsonResponse
    {
        return response()->json(['data' => $sync->sweep($this->actor($request))]);
    }
}
