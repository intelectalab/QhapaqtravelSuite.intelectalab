<?php

declare(strict_types=1);

namespace App\Domain\Admin\Http\Controllers;

use App\Domain\Admin\Actions\ManageOAuthApps;
use App\Domain\Admin\Support\ApiDirectory;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

final class OAuthAppController
{
    public function index(ManageOAuthApps $apps): JsonResponse
    {
        return response()->json([
            'data' => $apps->list(),
            'meta' => ['scopes' => collect(ApiDirectory::SCOPES)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values()],
        ]);
    }

    public function store(Request $request, ManageOAuthApps $apps): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:120'],
            'vendor' => ['required', 'string', 'min:2', 'max:120'],
            'scopes' => ['required', 'array', 'min:1'],
            'scopes.*' => [Rule::in(ManageOAuthApps::scopes())],
            'redirect_uris' => ['required', 'array', 'min:1', 'max:5'],
            'redirect_uris.*' => ['required', 'string', 'max:300', 'url:https'],
        ], [
            'name.*' => 'Ponle a la aplicación un nombre de 3 a 120 caracteres.',
            'vendor.*' => 'Escribe quién provee la aplicación.',
            'scopes.required' => 'Elige al menos un permiso.',
            'scopes.*' => 'Elige permisos de la lista.',
            'redirect_uris.required' => 'Escribe al menos una URL de retorno.',
            'redirect_uris.max' => 'Admite hasta cinco URL de retorno.',
            'redirect_uris.*' => 'Las URL de retorno deben empezar con https://.',
        ]);

        return response()->json(['data' => $apps->create($data, $this->user($request))], 201);
    }

    public function rotate(Request $request, string $id, ManageOAuthApps $apps): JsonResponse
    {
        return response()->json(['data' => $apps->rotate($id, $this->user($request))]);
    }

    public function destroy(Request $request, string $id, ManageOAuthApps $apps): Response
    {
        $apps->revoke($id, $this->user($request));

        return response()->noContent();
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
