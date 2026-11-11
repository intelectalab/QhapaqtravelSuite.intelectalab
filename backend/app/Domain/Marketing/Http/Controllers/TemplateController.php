<?php

declare(strict_types=1);

namespace App\Domain\Marketing\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Marketing\Actions\TemplateWorkflow;
use App\Domain\Marketing\Support\CampaignDirectory;
use App\Domain\Marketing\Support\SandboxTemplateReviewer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class TemplateController
{
    public function index(CampaignDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->templates(), 'meta' => ['variables' => TemplateWorkflow::VARIABLES, 'categories' => TemplateWorkflow::CATEGORIES]]);
    }

    public function store(Request $request, TemplateWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'channel' => ['required', 'in:email,whatsapp'],
            ...$this->contentRules(),
        ], ['channel.*' => 'Elige el canal.', ...$this->messages()]);

        return response()->json(['data' => ['code' => $workflow->create($data, $this->user($request))]], 201);
    }

    public function update(Request $request, string $code, TemplateWorkflow $workflow): JsonResponse
    {
        $data = $request->has('meta_status')
            ? $request->validate(['meta_status' => ['required', Rule::in(SandboxTemplateReviewer::RESPONSES)]], ['meta_status.*' => 'Indica si Meta la aprobó o la rechazó.'])
            : $request->validate($this->contentRules(), $this->messages());

        return response()->json(['data' => ['code' => $code, 'status' => $workflow->update($code, $data, $this->user($request))]]);
    }

    private function contentRules(): array
    {
        return [
            'name' => ['required', 'string', 'min:3', 'max:120'],
            'category' => ['required', Rule::in(array_keys(TemplateWorkflow::CATEGORIES))],
            'subject' => ['nullable', 'string', 'max:200'],
            'body' => ['required', 'string', 'min:10', 'max:5000'],
        ];
    }

    private function messages(): array
    {
        return [
            'name.*' => 'Escribe un nombre de 3 a 120 caracteres.',
            'category.*' => 'Elige la categoría.',
            'subject.*' => 'El asunto admite hasta 200 caracteres.',
            'body.*' => 'Escribe el mensaje (10 a 5000 caracteres).',
        ];
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
