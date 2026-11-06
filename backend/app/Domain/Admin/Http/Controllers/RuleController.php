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

    public function toggle(Request $request, string $code, ManageBookingRules $rules): JsonResponse
    {
        $request->validate(['enabled' => ['required', 'boolean']], ['enabled.*' => 'Indica si la regla queda activa.']);
        $rules->toggle($code, $request->boolean('enabled'), $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function params(Request $request, string $code, ManageBookingRules $rules): JsonResponse
    {
        $rules->params($code, (array) $request->input('params', []), $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function reset(Request $request, string $code, ManageBookingRules $rules): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:200']], ['reason.*' => 'Cuéntanos por qué restableces la regla.']);
        $rules->reset($code, $data['reason'], $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function store(Request $request, ManageBookingRules $rules): JsonResponse
    {
        $code = $rules->create($this->validated($request), $this->user($request));

        return response()->json(['data' => ['code' => $code]], 201);
    }

    public function update(Request $request, string $code, ManageBookingRules $rules): JsonResponse
    {
        $rules->update($code, $this->validated($request), $this->user($request));

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
