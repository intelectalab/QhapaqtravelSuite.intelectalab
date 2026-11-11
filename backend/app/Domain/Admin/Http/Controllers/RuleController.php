<?php

declare(strict_types=1);

namespace App\Domain\Admin\Http\Controllers;

use App\Domain\Admin\Actions\ManageBookingRules;
use App\Domain\Admin\Support\BookingRuleSimulator;
use App\Domain\Admin\Support\RuleDirectory;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class RuleController
{
    public function index(Request $request, RuleDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->list($this->user($request))]);
    }

    public function simulatorOptions(BookingRuleSimulator $simulator): JsonResponse
    {
        return response()->json(['data' => $simulator->options()]);
    }

    public function simulate(Request $request, BookingRuleSimulator $simulator): JsonResponse
    {
        $data = $request->validate([
            'product' => ['required', 'string', 'max:40'],
            'date' => ['required', 'date_format:Y-m-d'],
            'adt' => ['required', 'integer', 'between:0,50'],
            'chd' => ['nullable', 'integer', 'between:0,50'],
            'inf' => ['nullable', 'integer', 'between:0,50'],
            'currency' => ['nullable', 'in:PEN,USD'],
            'payment_mode' => ['nullable', 'in:total,adelanto,pagar_despues'],
            'payment_method' => ['nullable', 'string', 'max:30'],
            'promo_code' => ['nullable', 'string', 'max:40'],
            'channel' => ['nullable', 'in:Directo,Corporativo,B2B,E-commerce'],
            'plan' => ['nullable', 'in:'.implode(',', $simulator->plans())],
        ], [
            'product.*' => 'Elige el producto a simular.',
            'date.*' => 'Elige la fecha del servicio.',
            'adt.*' => 'Indica cuántos adultos (0 a 50).',
            'chd.*' => 'Indica cuántos niños (0 a 50).',
            'inf.*' => 'Indica cuántos infantes (0 a 50).',
            'currency.*' => 'Elige soles o dólares.',
            'payment_mode.*' => 'Elige una modalidad de pago de la lista.',
            'plan.*' => 'Elige un plan de la lista.',
        ]);

        return response()->json(['data' => $simulator->simulate($data)]);
    }

    public function reset(Request $request, ManageBookingRules $rules): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['required', 'string', 'min:3', 'max:200'],
            'code' => ['nullable', 'string', 'max:40'],
        ], ['reason.*' => 'Cuéntanos por qué restableces la regla.', 'code.*' => 'Elige una regla de la lista.']);
        $codes = $rules->reset($data['code'] ?? null, $data['reason'], $this->user($request));

        return response()->json(['data' => ['code' => $data['code'] ?? null, 'codes' => $codes]]);
    }

    public function applyTemplate(Request $request, ManageBookingRules $rules): JsonResponse
    {
        $data = $request->validate(['template' => ['required', 'string', 'max:30']], ['template.*' => 'Elige una plantilla de la lista.']);

        return response()->json(['data' => $rules->applyTemplate($data['template'], $this->user($request))]);
    }

    public function audit(Request $request, RuleDirectory $directory): JsonResponse
    {
        return response()->json($directory->auditPage($request));
    }

    public function store(Request $request, ManageBookingRules $rules): JsonResponse
    {
        $code = $rules->create($this->validated($request), $this->user($request));

        return response()->json(['data' => ['code' => $code]], 201);
    }

    public function update(Request $request, string $code, ManageBookingRules $rules): JsonResponse
    {
        $user = $this->user($request);

        if ($request->has('enabled')) {
            $request->validate(['enabled' => ['required', 'boolean']], ['enabled.*' => 'Indica si la regla queda activa.']);
            $rules->toggle($code, $request->boolean('enabled'), $user);
        } elseif ($request->has('params')) {
            $request->validate(['params' => ['present', 'array']], ['params.*' => 'Envía los parámetros de la regla.']);
            $rules->params($code, (array) $request->input('params', []), $user);
        } else {
            $rules->update($code, $this->validated($request), $user);
        }

        return response()->json(['data' => ['code' => $code]]);
    }

    public function destroy(string $code, ManageBookingRules $rules): JsonResponse
    {
        $rules->delete($code);

        return response()->json(['data' => ['code' => $code]]);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:160'],
            'description' => ['required', 'string', 'min:10', 'max:600'],
            'group' => ['required', 'in:'.implode(',', RuleDirectory::GROUPS)],
        ], [
            'name.*' => 'Escribe un nombre de al menos 3 caracteres.',
            'description.*' => 'Describe qué hará la regla (mínimo 10 caracteres).',
            'group.*' => 'Elige el grupo.',
        ]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
