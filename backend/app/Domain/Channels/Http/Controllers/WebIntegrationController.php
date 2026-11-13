<?php

declare(strict_types=1);

namespace App\Domain\Channels\Http\Controllers;

use App\Domain\Channels\Actions\ManageWebIntegration;
use App\Domain\Channels\Support\WebIntegrationDirectory;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class WebIntegrationController
{
    public function index(Request $request, WebIntegrationDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->user($request))]);
    }

    public function defaults(Request $request, ManageWebIntegration $manage): JsonResponse
    {
        $data = $request->validate([
            'mode' => ['nullable', 'in:producto,catalogo'],
            'category' => ['nullable', 'string', 'max:120'],
            'product' => ['required_unless:mode,catalogo', 'nullable', 'string', 'exists:catalog_products,code'],
            'method' => ['required', Rule::in(array_keys(WebIntegrationDirectory::METHODS))],
            'lang' => ['required', 'in:es,en'],
            'currency' => ['required', 'in:PEN,USD'],
            'theme' => ['required', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'radius' => ['required', 'integer', 'between:0,24'],
            'reviews' => ['nullable', 'boolean'],
            'domain' => ['nullable', 'string', 'max:190'],
        ], [
            'mode.*' => 'Elige si el widget muestra un producto o el catálogo.',
            'category.*' => 'La categoría no es válida.',
            'product.*' => 'Elige un producto publicado.',
            'method.*' => 'Elige el método de integración.',
            'lang.*' => 'Elige el idioma.',
            'currency.*' => 'Elige la moneda.',
            'theme.*' => 'El color debe tener el formato #RRGGBB.',
            'radius.*' => 'El radio debe estar entre 0 y 24.',
        ]);
        $manage->saveDefaults($data, $this->user($request));

        return response()->json(['data' => ['saved' => true]]);
    }

    public function rotateKey(Request $request, ManageWebIntegration $manage): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:300']], ['reason.*' => 'Escribe el motivo del cambio de clave (al menos 5 caracteres).']);

        return response()->json(['data' => $manage->rotateKey(trim($data['reason']), $this->user($request))]);
    }

    public function storeDomain(Request $request, ManageWebIntegration $manage): JsonResponse
    {
        $data = $request->validate([
            'domain' => ['required', 'string', 'max:190', 'regex:/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i'],
            'cms' => ['nullable', 'string', 'max:60'],
        ], ['domain.*' => 'Escribe un dominio válido, sin https:// ni rutas.', 'cms.*' => 'El CMS admite hasta 60 caracteres.']);
        $manage->addDomain($data['domain'], $data['cms'] ?? null, $this->user($request));

        return response()->json(['data' => ['domain' => $data['domain']]], 201);
    }

    public function verifyDomain(Request $request, string $id, ManageWebIntegration $manage): JsonResponse
    {
        $manage->verifyDomain($id, $this->user($request));

        return response()->json(['data' => ['id' => $id]]);
    }

    public function destroyDomain(string $id, ManageWebIntegration $manage): JsonResponse
    {
        $manage->removeDomain($id);

        return response()->json(['data' => ['id' => $id]]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
