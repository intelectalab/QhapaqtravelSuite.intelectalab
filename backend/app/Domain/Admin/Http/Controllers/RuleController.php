<?php

declare(strict_types=1);

namespace App\Domain\Admin\Http\Controllers;

use App\Domain\Admin\Actions\ManageBookingRules;
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

    public function reset(Request $request, ManageBookingRules $rules): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['required', 'string', 'min:3', 'max:200'],
            'code' => ['nullable', 'string', 'max:40'],
        ], ['reason.*' => 'Cuéntanos por qué restableces la regla.', 'code.*' => 'Elige una regla de la lista.']);
        $codes = $rules->reset($data['code'] ?? null, $data['reason'], $this->user($request));

        return response()->json(['data' => ['code' => $data['code'] ?? null, 'codes' => $codes]]);
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
