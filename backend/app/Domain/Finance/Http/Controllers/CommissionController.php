<?php

declare(strict_types=1);

namespace App\Domain\Finance\Http\Controllers;

use App\Domain\Finance\Actions\CommissionWorkflow;
use App\Domain\Finance\Http\Controllers\Concerns\ResolvesActor;
use App\Domain\Finance\Support\CommissionDirectory;
use App\Domain\Finance\Support\CommissionRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class CommissionController
{
    use ResolvesActor;

    public function index(Request $request, CommissionDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->actor($request))]);
    }

    public function calculate(Request $request, CommissionWorkflow $workflow): JsonResponse
    {
        $actor = $this->actor($request);
        $this->requireOperator($actor);

        return response()->json(['data' => ['created' => $workflow->calculate($actor)]], 201);
    }

    public function approve(Request $request, string $code, CommissionWorkflow $workflow): JsonResponse
    {
        $workflow->approve($code, $this->actor($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function pay(Request $request, string $code, CommissionWorkflow $workflow): JsonResponse
    {
        $actor = $this->actor($request);
        $this->requireOperator($actor);
        $data = $request->validate([
            'method' => ['required', 'string', 'max:40'],
            'reference' => ['required', 'string', 'max:80'],
        ], [
            'method.*' => 'Elige la forma de pago.',
            'reference.*' => 'Indica la referencia del pago (planilla, operación o nota de crédito).',
        ]);
        $workflow->pay($code, $data['method'], $data['reference'], $actor);

        return response()->json(['data' => ['code' => $code]]);
    }

    public function recalculate(Request $request, string $code, CommissionWorkflow $workflow): JsonResponse
    {
        $actor = $this->actor($request);
        $this->requireOperator($actor);
        $data = $request->validate(['lock_version' => ['nullable', 'integer']]);

        return response()->json(['data' => $workflow->recalculate($code, isset($data['lock_version']) ? (int) $data['lock_version'] : null, $actor)]);
    }

    public function rules(): JsonResponse
    {
        return response()->json(['data' => CommissionRules::list()]);
    }

    public function storeRule(Request $request, CommissionRules $rules): JsonResponse
    {
        $actor = $this->actor($request);
        $this->requireOperator($actor);
        $data = $request->validate($this->ruleRules(true), self::RULE_MESSAGES);

        return response()->json(['data' => ['id' => $rules->save(null, $data, null, $actor)]], 201);
    }

    public function updateRule(Request $request, string $id, CommissionRules $rules): JsonResponse
    {
        $actor = $this->actor($request);
        $this->requireOperator($actor);
        $data = $request->validate([...$this->ruleRules(false), 'lock_version' => ['nullable', 'integer']], self::RULE_MESSAGES);
        $lock = isset($data['lock_version']) ? (int) $data['lock_version'] : null;
        unset($data['lock_version']);

        return response()->json(['data' => ['id' => $rules->save($id, $data, $lock, $actor)]]);
    }

    private const RULE_MESSAGES = [
        'condition.*' => 'Elige a qué ventas aplica la regla.',
        'pct.*' => 'El porcentaje va de 0.01 a 50.',
        'base_type.*' => 'Elige la base de cálculo.',
        'valid_from.*' => 'Indica desde cuándo rige.',
        'valid_to.*' => 'La vigencia termina después de empezar.',
    ];

    private function ruleRules(bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes';

        return [
            'condition' => [$required, 'in:'.implode(',', array_keys(CommissionDirectory::CONDITIONS))],
            'pct' => ['nullable', 'numeric', 'gt:0', 'lte:50'],
            'base_type' => [$required, 'in:neto_sin_igv,total'],
            'valid_from' => [$required, 'date'],
            'valid_to' => ['nullable', 'date'],
            'active' => ['sometimes', 'boolean'],
        ];
    }

    public function annul(Request $request, string $code, CommissionWorkflow $workflow): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']], ['reason.*' => 'Explica el motivo de la anulación (mínimo 5 caracteres).']);
        $workflow->annul($code, $data['reason'], $this->actor($request));

        return response()->json(['data' => ['code' => $code]]);
    }
}
