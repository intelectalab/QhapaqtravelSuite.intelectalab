<?php

declare(strict_types=1);

namespace App\Domain\Iam\Http\Controllers;

use App\Domain\Iam\Actions\UserAdmin;
use App\Domain\Iam\Models\User;
use App\Domain\Iam\Support\UserDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;

final class UserController
{
    public function __construct(private readonly UserDirectory $directory, private readonly UserAdmin $admin) {}

    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->directory->list(), 'meta' => $this->directory->options()]);
    }

    public function show(string $id): JsonResponse
    {
        return response()->json(['data' => $this->directory->find($id)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'email' => ['required', 'regex:/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/', 'max:190'],
            'phone' => ['nullable', 'string', 'max:30'],
            'role' => ['required', 'string', 'max:40'],
            'sede_id' => ['required', 'uuid', $this->activeSede()],
            'require_mfa' => ['nullable', 'boolean'],
        ], $this->messages());

        return response()->json(['data' => ['code' => $this->admin->invite($data, $this->user($request))]], 201);
    }

    public function update(Request $request, string $code): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'phone' => ['nullable', 'string', 'max:30'],
            'role' => ['required', 'string', 'max:40'],
            'sede_id' => ['required', 'uuid', $this->activeSede()],
            'email' => ['prohibited'],
        ], [...$this->messages(), 'email.prohibited' => 'El correo no se cambia después de invitar.']);
        $this->admin->update($code, $data, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function deactivate(Request $request, string $code): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:300']], ['reason.*' => 'Escribe el motivo.']);

        return response()->json(['data' => ['code' => $code], 'meta' => ['warnings' => $this->admin->deactivate($code, $data['reason'], $this->user($request))]]);
    }

    public function activate(Request $request, string $code): JsonResponse
    {
        $this->admin->activate($code, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function resetMfa(Request $request, string $code): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:300']], ['reason.*' => 'Escribe el motivo.']);
        $this->admin->resetMfa($code, $data['reason'], $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function resendInvitation(Request $request, string $code): JsonResponse
    {
        $this->admin->resendInvitation($code, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    private function messages(): array
    {
        return [
            'name.required' => 'Escribe el nombre.',
            'email.required' => 'Escribe el correo.',
            'email.regex' => 'Escribe un correo válido.',
            'role.required' => 'Elige el rol.',
            'sede_id.required' => 'Elige la sede.',
            'sede_id.exists' => 'Elige una sede activa de la lista.',
        ];
    }

    private function activeSede(): Exists
    {
        return Rule::exists('iam_sedes', 'id')->whereNull('deleted_at')->where('status', 'activa');
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
