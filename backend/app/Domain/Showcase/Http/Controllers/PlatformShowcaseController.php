<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Http\Controllers;

use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Showcase\Actions\ManageShowcaseAgencies;
use App\Domain\Showcase\Actions\ManageShowcaseListings;
use App\Domain\Showcase\Actions\ManageShowcasePosts;
use App\Domain\Showcase\Support\ShowcaseDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PlatformShowcaseController
{
    public function moderation(ShowcaseDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->moderation()]);
    }

    public function decide(Request $request, string $code, ManageShowcaseListings $listings): JsonResponse
    {
        $data = $request->validate(['decision' => ['required', 'in:aprobar,rechazar'], 'reason' => ['nullable', 'string', 'max:500']], ['decision.*' => 'Elige aprobar o rechazar.']);

        return response()->json(['data' => $listings->decide($code, $data['decision'], $data['reason'] ?? null, self::user($request))]);
    }

    public function verify(Request $request, string $code, ManageShowcaseAgencies $agencies): JsonResponse
    {
        $data = $request->validate(['action' => ['nullable', 'in:'.implode(',', array_keys(ManageShowcaseAgencies::ACTIONS))], 'reason' => ['nullable', 'string', 'max:300']]);

        return response()->json(['data' => $agencies->transition($code, $data['action'] ?? 'verificar', $data['reason'] ?? null, self::user($request))]);
    }

    public function funnel(ShowcaseDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->funnel()]);
    }

    public function posts(ShowcaseDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->posts(false)]);
    }

    public function storePost(Request $request, ManageShowcasePosts $posts): JsonResponse
    {
        $data = $request->validate($this->postRules(true), $this->postMessages());

        return response()->json(['data' => $posts->create($data, self::user($request))]);
    }

    public function updatePost(Request $request, string $id, ManageShowcasePosts $posts): JsonResponse
    {
        $data = $request->validate([...$this->postRules(false), 'status' => ['nullable', 'in:'.implode(',', ManageShowcasePosts::STATUSES)]], $this->postMessages());

        return response()->json(['data' => $posts->update($id, $data, self::user($request))]);
    }

    public static function user(Request $request): PlatformUser
    {
        $user = call_user_func($request->getUserResolver());

        if (! $user instanceof PlatformUser) {
            throw ApiException::forbidden('PLATFORM_ONLY', 'Esta acción es exclusiva de la consola de plataforma.', ['admin.tenant.manage']);
        }

        return $user;
    }

    private function postRules(bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes';

        return [
            'title' => [$required, 'string', 'min:10', 'max:200'],
            'slug' => ['nullable', 'string', 'max:160'],
            'excerpt' => [$required, 'string', 'min:20', 'max:320'],
            'body' => ['nullable', 'string', 'max:100000'],
            'city' => ['nullable', 'string', 'max:40'],
            'focus_keyword' => [$required, 'string', 'min:3', 'max:120'],
            'linked_listings' => ['nullable', 'array', 'max:12'],
            'linked_listings.*' => ['uuid'],
            'seo_score' => ['nullable', 'integer', 'between:0,100'],
        ];
    }

    private function postMessages(): array
    {
        return [
            'title.*' => 'El título va de 10 a 200 caracteres.',
            'excerpt.*' => 'El resumen va de 20 a 320 caracteres.',
            'focus_keyword.*' => 'Indica la palabra clave principal.',
            'linked_listings.*' => 'Elige tours de la vitrina.',
        ];
    }
}
