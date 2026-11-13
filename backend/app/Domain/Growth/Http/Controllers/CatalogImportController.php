<?php

declare(strict_types=1);

namespace App\Domain\Growth\Http\Controllers;

use App\Domain\Growth\CatalogImport\CatalogImports;
use App\Domain\Growth\Shared\GrowthRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class CatalogImportController
{
    public function __construct(private readonly CatalogImports $imports) {}

    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->imports->index()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'source_type' => ['required', Rule::in(array_keys(CatalogImports::SOURCES))],
            'source_url' => ['required_if:source_type,url', 'nullable', 'url:https,http', 'max:500'],
            'content' => ['nullable', 'string', 'max:200000'],
            'file' => ['nullable', 'file', 'max:10240'],
        ], [
            'source_type.*' => 'Elige de dónde vienen los productos.',
            'source_url.*' => 'Escribe la dirección completa de la página (https://…).',
            'content.*' => 'El contenido pegado admite hasta 200 000 caracteres.',
            'file.*' => 'Adjunta un archivo de hasta 10 MB.',
        ]);

        return response()->json(['data' => $this->imports->create($data, $request->file('file'), GrowthRules::actor($request))], 201);
    }

    public function show(string $code): JsonResponse
    {
        return response()->json(['data' => $this->imports->show($code)]);
    }

    public function confirm(Request $request, string $code): JsonResponse
    {
        $data = $request->validate([
            'products' => ['required', 'array', 'min:1', 'max:200'],
            'products.*' => ['required', 'string', 'max:20'],
        ], ['products.*' => 'Elige al menos un producto detectado.']);

        return response()->json(['data' => $this->imports->confirm($code, $data['products'], GrowthRules::actor($request))]);
    }

    public function cancel(Request $request, string $code): JsonResponse
    {
        return response()->json(['data' => $this->imports->cancel($code, GrowthRules::actor($request))]);
    }
}
