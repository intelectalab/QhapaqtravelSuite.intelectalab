<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Http\Controllers;

use App\Domain\Catalog\Actions\ProductTranslations;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class ProductTranslationController
{
    public function index(string $code, ProductTranslations $translations): JsonResponse
    {
        return response()->json(['data' => $translations->show($code)]);
    }

    public function update(Request $request, string $code, string $locale, ProductTranslations $translations): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:160'],
            'short' => ['nullable', 'string', 'max:600'],
            'long' => ['nullable', 'string', 'max:8000'],
            'inclusions' => ['nullable'],
            'exclusions' => ['nullable'],
            'seo_title' => ['nullable', 'string', 'max:120'],
            'seo_description' => ['nullable', 'string', 'max:320'],
            'slug' => ['nullable', 'string', 'max:160'],
        ], [
            'name.*' => 'Escribe el nombre traducido (3 a 160 caracteres).',
            'short.*' => 'El resumen admite hasta 600 caracteres.',
            'long.*' => 'La descripción admite hasta 8 000 caracteres.',
            'seo_title.*' => 'El título SEO admite hasta 120 caracteres.',
            'seo_description.*' => 'La descripción SEO admite hasta 320 caracteres.',
        ]);

        return response()->json(['data' => $translations->save($code, $locale, $data, $this->user($request))]);
    }

    public function destroy(Request $request, string $code, string $locale, ProductTranslations $translations): Response
    {
        $translations->delete($code, $locale, $this->user($request));

        return response()->noContent();
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
