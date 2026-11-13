<?php

declare(strict_types=1);

namespace App\Domain\Growth\Http\Controllers;

use App\Domain\Growth\Shared\GrowthRules;
use App\Domain\Growth\Whatsapp\WhatsappTemplates;
use App\Domain\Marketing\Support\SandboxTemplateReviewer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class WhatsappTemplateController
{
    private const MESSAGES = [
        'name.*' => 'El nombre va en minúsculas, números y guion bajo, como lo pide Meta (hasta 80 caracteres).',
        'lang.*' => 'Elige el idioma de la plantilla.',
        'category.*' => 'Elige la categoría de Meta.',
        'purpose.*' => 'Elige para qué se usa la plantilla.',
        'body.*' => 'Escribe el texto de la plantilla (10 a 1024 caracteres).',
        'meta_status.*' => 'Indica si Meta la aprobó o la rechazó.',
        'action.*' => 'La acción debe ser pausar o reanudar.',
        'rejected_reason.*' => 'El motivo admite hasta 300 caracteres.',
    ];

    public function __construct(private readonly WhatsappTemplates $templates) {}

    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->templates->overview()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'regex:/^[a-z0-9_]{3,80}$/'],
            'lang' => ['required', Rule::in(array_keys(WhatsappTemplates::LANGS))],
            'category' => ['required', Rule::in(array_keys(WhatsappTemplates::CATEGORIES))],
            'purpose' => ['required', Rule::in(array_keys(WhatsappTemplates::PURPOSES))],
            'body' => ['required', 'string', 'min:10', 'max:1024'],
        ], self::MESSAGES);

        return response()->json(['data' => $this->templates->create($data, GrowthRules::actor($request))], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'meta_status' => ['nullable', Rule::in(SandboxTemplateReviewer::RESPONSES)],
            'rejected_reason' => ['nullable', 'string', 'max:300'],
            'action' => ['nullable', Rule::in(['pausar', 'reanudar'])],
            'category' => ['nullable', Rule::in(array_keys(WhatsappTemplates::CATEGORIES))],
            'purpose' => ['nullable', Rule::in(array_keys(WhatsappTemplates::PURPOSES))],
            'body' => ['nullable', 'string', 'min:10', 'max:1024'],
        ], self::MESSAGES);

        return response()->json(['data' => $this->templates->update($id, array_filter($data, fn ($value) => $value !== null), GrowthRules::actor($request))]);
    }

    public function send(Request $request, string $code): JsonResponse
    {
        $data = $request->validate([
            'template' => ['required', 'string', 'max:80'],
            'variables' => ['nullable', 'array', 'max:20'],
            'variables.*' => ['nullable', 'string', 'max:300'],
        ], ['template.*' => 'Elige una plantilla aprobada.', 'variables.*' => 'Cada variable admite hasta 300 caracteres.']);

        return response()->json(['data' => $this->templates->send($code, $data, GrowthRules::actor($request))], 201);
    }
}
