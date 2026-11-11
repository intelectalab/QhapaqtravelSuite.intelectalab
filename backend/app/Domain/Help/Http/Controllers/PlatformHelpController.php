<?php

declare(strict_types=1);

namespace App\Domain\Help\Http\Controllers;

use App\Domain\Help\Actions\PlatformHelpArticles;
use App\Domain\Help\Support\HelpArticleShape;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Shared\Concurrency\IfMatch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class PlatformHelpController
{
    public function __construct(private readonly PlatformHelpArticles $articles) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:80'],
            'module' => ['nullable', 'string', 'max:60'],
            'status' => ['nullable', Rule::in(['published', 'archived', 'all'])],
            'audience' => ['nullable', Rule::in([...array_keys(HelpArticleShape::AUDIENCES), 'all'])],
        ]);

        return response()->json(['data' => $this->articles->index($filters)]);
    }

    public function screen(Request $request): JsonResponse
    {
        $data = $request->validate(['path' => ['required', 'string', 'max:300']], ['path.*' => 'Indica la pantalla.']);

        return response()->json(['data' => $this->articles->screen($data['path'])]);
    }

    public function show(string $slug): JsonResponse
    {
        return response()->json(['data' => $this->articles->show($slug)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(HelpArticleShape::rules(true), HelpArticleShape::messages());
        $slug = $this->articles->create($data, $this->user($request));

        return response()->json(['data' => $this->articles->show($slug)], 201);
    }

    public function update(Request $request, string $slug): JsonResponse
    {
        $expected = IfMatch::from($request);
        $data = $request->validate(HelpArticleShape::rules(), HelpArticleShape::messages());
        $this->articles->update($slug, $data, $expected, $this->user($request));

        return response()->json(['data' => $this->articles->show($slug)]);
    }

    public function archive(Request $request, string $slug): JsonResponse
    {
        $this->articles->status($slug, 'archived', IfMatch::from($request), $this->user($request));

        return response()->json(['data' => $this->articles->show($slug)]);
    }

    public function restore(Request $request, string $slug): JsonResponse
    {
        $this->articles->status($slug, 'published', IfMatch::from($request), $this->user($request));

        return response()->json(['data' => $this->articles->show($slug)]);
    }

    private function user(Request $request): PlatformUser
    {
        $user = $request->user('sanctum');
        assert($user instanceof PlatformUser);

        return $user;
    }
}
