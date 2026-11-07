<?php

declare(strict_types=1);

namespace App\Domain\Channels\Http\Controllers;

use App\Domain\Channels\Actions\ManageCmsContent;
use App\Domain\Channels\Support\CmsDirectory;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class CmsController
{
    public function index(Request $request, CmsDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->user($request))]);
    }

    public function store(Request $request, ManageCmsContent $manage): JsonResponse
    {
        $code = $manage->create($this->validated($request), $this->user($request));

        return response()->json(['data' => ['code' => $code]], 201);
    }

    public function update(Request $request, string $code, ManageCmsContent $manage): JsonResponse
    {
        $manage->update($code, $this->validated($request), $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function transition(Request $request, string $code, string $action, ManageCmsContent $manage): JsonResponse
    {
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:300']], ['reason.*' => 'El motivo admite hasta 300 caracteres.']);
        $manage->transition($code, CmsDirectory::ACTIONS[$action], $data['reason'] ?? null, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function destroy(Request $request, string $code, ManageCmsContent $manage): JsonResponse
    {
        $manage->archive($code, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'min:3', 'max:200'],
            'type' => ['required', Rule::in(CmsDirectory::TYPES)],
            'channel' => ['required', Rule::in(CmsDirectory::CHANNELS)],
            'slug' => ['nullable', 'string', 'max:60'],
            'body' => ['required', 'string', 'max:20000'],
            'seo_title' => ['nullable', 'string', 'max:60'],
            'seo_description' => ['nullable', 'string', 'max:160'],
            'placement' => ['nullable', 'string', 'max:40'],
            'valid_from' => ['nullable', 'date'],
            'valid_to' => ['nullable', 'date', 'after_or_equal:valid_from'],
        ], [
            'title.*' => 'Indica un título de al menos 3 caracteres.',
            'type.*' => 'Elige el tipo de contenido.',
            'channel.*' => 'Elige el canal.',
            'slug.*' => 'La URL admite hasta 60 caracteres.',
            'body.*' => 'Escribe el contenido.',
            'seo_title.*' => 'El título SEO admite hasta 60 caracteres.',
            'seo_description.*' => 'La descripción SEO admite hasta 160 caracteres.',
            'valid_to.after_or_equal' => 'La vigencia no puede terminar antes de empezar.',
        ]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
