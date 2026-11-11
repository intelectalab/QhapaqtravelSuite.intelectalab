<?php

declare(strict_types=1);

namespace App\Domain\Admin\Http\Controllers;

use App\Domain\Admin\Actions\ManagePaxTemplates;
use App\Domain\Admin\Support\PaxTemplateDirectory;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PaxTemplateController
{
    public function index(Request $request, PaxTemplateDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->list($this->user($request))]);
    }

    public function messages(Request $request, PaxTemplateDirectory $directory): JsonResponse
    {
        return response()->json($directory->messagesPage($request));
    }

    public function store(Request $request, ManagePaxTemplates $templates): JsonResponse
    {
        $code = $templates->create($this->validated($request), $this->user($request));

        return response()->json(['data' => ['code' => $code]], 201);
    }

    public function update(Request $request, string $code, ManagePaxTemplates $templates): JsonResponse
    {
        if ($request->has('active') && ! $request->has('name')) {
            $request->validate(['active' => ['required', 'boolean']], ['active.*' => 'Indica si la plantilla queda activa.']);

            return response()->json(['data' => ['code' => $code, 'active' => $templates->setActive($code, $request->boolean('active'), $this->user($request))]]);
        }

        $templates->update($code, $this->validated($request), $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function destroy(string $code, ManagePaxTemplates $templates): JsonResponse
    {
        $templates->delete($code);

        return response()->json(['data' => ['code' => $code]]);
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:120'],
            'event' => ['required', 'in:'.implode(',', array_keys(PaxTemplateDirectory::EVENTS))],
            'offset_hours' => ['required', 'integer', 'between:-720,720'],
            'channels' => ['required', 'array', 'min:1'],
            'channels.*' => ['in:'.implode(',', array_keys(PaxTemplateDirectory::CHANNELS))],
            'subject' => ['nullable', 'string', 'max:200'],
            'body' => ['required', 'string', 'min:10', 'max:4000'],
            'lang' => ['required', 'in:ES,EN'],
            'requires_rule' => ['nullable', 'string', 'exists:sys_booking_rules,code'],
            'products' => ['nullable', 'array', 'max:50'],
            'products.*' => ['uuid', 'exists:catalog_products,id'],
            'sales_channels' => ['nullable', 'array'],
            'sales_channels.*' => ['in:'.implode(',', array_keys(PaxTemplateDirectory::SALES_CHANNELS))],
        ], [
            'name.*' => 'Escribe un nombre de al menos 3 caracteres.',
            'event.*' => 'Elige el momento del viaje.',
            'offset_hours.*' => 'El desfase va de −720 a 720 horas.',
            'channels.required' => 'Elige al menos un canal (MSG-01).',
            'channels.*' => 'Elige canales de la lista.',
            'subject.*' => 'El asunto admite hasta 200 caracteres.',
            'body.*' => 'Escribe el mensaje (mínimo 10 caracteres).',
            'lang.*' => 'Elige el idioma.',
            'requires_rule.*' => 'Elige una regla existente.',
            'products.*' => 'Elige productos del catálogo.',
            'sales_channels.*' => 'Elige canales de venta de la lista.',
        ]);

        return [...$data, 'only_if_balance' => $request->boolean('only_if_balance'), 'only_if_missing_docs' => $request->boolean('only_if_missing_docs')];
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
