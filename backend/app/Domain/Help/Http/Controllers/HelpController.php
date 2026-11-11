<?php

declare(strict_types=1);

namespace App\Domain\Help\Http\Controllers;

use App\Domain\Help\Actions\ManageHelpArticles;
use App\Domain\Help\Support\HelpArticleShape;
use App\Domain\Help\Support\HelpLibrary;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Concurrency\IfMatch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class HelpController
{
    public function __construct(private readonly HelpLibrary $library, private readonly ManageHelpArticles $articles) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:80'],
            'module' => ['nullable', 'string', 'max:60'],
            'status' => ['nullable', Rule::in(['published', 'archived', 'all'])],
        ]);

        return response()->json(['data' => $this->library->index($this->user($request), $filters)]);
    }

    public function screen(Request $request): JsonResponse
    {
        $data = $request->validate(['path' => ['required', 'string', 'max:300']], ['path.*' => 'Indica la pantalla.']);

        return response()->json(['data' => $this->library->screen($this->user($request), $data['path'])]);
    }

    public function show(Request $request, string $slug): JsonResponse
    {
        return response()->json(['data' => $this->library->show($this->user($request), $slug)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(HelpArticleShape::rules(), HelpArticleShape::messages());
        $slug = $this->articles->create($data, $this->user($request));

        return response()->json(['data' => $this->library->show($this->user($request), $slug)], 201);
    }

    public function update(Request $request, string $slug): JsonResponse
    {
        $expected = IfMatch::from($request);
        $data = $request->validate(HelpArticleShape::rules(), HelpArticleShape::messages());
        $this->articles->update($slug, $data, $expected, $this->user($request));

        return response()->json(['data' => $this->library->show($this->user($request), $slug)]);
    }

    public function archive(Request $request, string $slug): JsonResponse
    {
        $this->articles->archive($slug, IfMatch::from($request), $this->user($request));

        return response()->json(['data' => $this->library->show($this->user($request), $slug)]);
    }

    public function restore(Request $request, string $slug): JsonResponse
    {
        $this->articles->restore($slug, IfMatch::from($request), $this->user($request));

        return response()->json(['data' => $this->library->show($this->user($request), $slug)]);
    }

    public function original(Request $request, string $slug): JsonResponse
    {
        $this->articles->original($slug);

        return response()->json(['data' => $this->library->show($this->user($request), $slug)]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
