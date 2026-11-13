<?php

declare(strict_types=1);

namespace App\Domain\SiteTemplates\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\SiteTemplates\Actions\SiteThemes;
use App\Domain\SiteTemplates\Support\ThemeTokens;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class SiteTemplateController
{
    public function index(SiteThemes $themes): JsonResponse
    {
        $items = $themes->gallery();

        return response()->json(['data' => $items, 'meta' => ['total' => count($items), 'available' => count(array_filter($items, fn (array $item): bool => $item['available'])), 'premium' => count(array_filter($items, fn (array $item): bool => $item['tier'] === 'premium'))]]);
    }

    public function show(string $code, SiteThemes $themes): JsonResponse
    {
        return response()->json(['data' => $themes->detail($code)]);
    }

    public function preview(string $code, Request $request, SiteThemes $themes): JsonResponse
    {
        return response()->json(['data' => $themes->preview($code, (string) $this->user($request)->getKey())]);
    }

    public function purchase(string $code, Request $request, SiteThemes $themes): JsonResponse
    {
        $user = $this->user($request);

        return response()->json(['data' => $themes->purchase($code, (string) $user->getKey(), $user->name)]);
    }

    public function theme(SiteThemes $themes): JsonResponse
    {
        return response()->json(['data' => $themes->overview()]);
    }

    public function apply(Request $request, SiteThemes $themes): JsonResponse
    {
        $data = $request->validate([
            'template_code' => ['required', 'string', 'max:20'],
            'version' => ['nullable', 'string', 'regex:/^[0-9]+\.[0-9]+\.[0-9]+$/'],
            'lock_version' => ['required', 'integer', 'min:0'],
        ], [
            'template_code.required' => 'Elija la plantilla que quiere aplicar.',
            'version.regex' => 'La versión debe tener el formato 1.2.3.',
        ]);
        $user = $this->user($request);
        $themes->apply($data['template_code'], $data['version'] ?? null, (int) $data['lock_version'], 'agencia', (string) $user->getKey(), $user->name);

        return response()->json(['data' => $themes->overview()]);
    }

    public function tokens(Request $request, SiteThemes $themes): JsonResponse
    {
        $data = $request->validate([...ThemeTokens::rules(), 'lock_version' => ['required', 'integer', 'min:0']], ThemeTokens::messages());
        $tokens = array_intersect_key($data, array_flip(['side', 'accent', 'sun', 'radius', 'sections']));

        if ($tokens === []) {
            return response()->json(['data' => $themes->overview()]);
        }

        $user = $this->user($request);
        $themes->updateTokens($tokens, (int) $data['lock_version'], (string) $user->getKey(), $user->name);

        return response()->json(['data' => $themes->overview()]);
    }

    public function restore(string $id, Request $request, SiteThemes $themes): JsonResponse
    {
        $user = $this->user($request);
        $themes->restore($id, (string) $user->getKey(), $user->name);

        return response()->json(['data' => $themes->overview()]);
    }

    public function publicTheme(Request $request, SiteThemes $themes): JsonResponse
    {
        $token = $request->query('preview');
        $data = $themes->publicTheme(is_string($token) ? mb_substr($token, 0, 64) : null);

        return response()->json(['data' => $data])->header('X-Robots-Tag', $data['noindex'] ? 'noindex, nofollow' : 'all')->header('Cache-Control', $data['preview'] ? 'no-store' : 'public, max-age=60');
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
