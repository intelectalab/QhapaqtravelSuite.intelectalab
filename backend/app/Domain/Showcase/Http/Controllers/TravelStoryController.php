<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Portal\Support\PortalAccount;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Showcase\Actions\ManageTravelStories;
use App\Domain\Showcase\Support\StoryDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class TravelStoryController
{
    private const MESSAGES = [
        'reservation.*' => 'Elige la reserva de la historia.',
        'title.*' => 'El título va de 5 a 200 caracteres.',
        'quote.*' => 'La frase del cliente admite hasta 600 caracteres.',
        'photo_count.*' => 'Indica cuántas fotos tiene (0 a 60).',
    ];

    public function index(Request $request, StoryDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->user($request)->can('channels.cms.publish'))]);
    }

    public function store(Request $request, ManageTravelStories $stories): JsonResponse
    {
        $data = $request->validate(['reservation' => ['required', 'string', 'max:40'], ...$this->rules(true)], self::MESSAGES);

        return response()->json(['data' => $stories->create($data, $this->user($request))], 201);
    }

    public function update(Request $request, string $id, ManageTravelStories $stories): JsonResponse
    {
        $data = $request->validate($this->rules(false), self::MESSAGES);

        return response()->json(['data' => $stories->update($id, $data)]);
    }

    public function destroy(string $id, ManageTravelStories $stories): Response
    {
        $stories->delete($id);

        return response()->noContent();
    }

    public function requestConsent(Request $request, string $id, ManageTravelStories $stories): JsonResponse
    {
        return response()->json(['data' => $stories->requestConsent($id, $this->user($request))]);
    }

    public function publish(string $id, ManageTravelStories $stories): JsonResponse
    {
        return response()->json(['data' => $stories->publish($id)]);
    }

    public function unpublish(Request $request, string $id, ManageTravelStories $stories): JsonResponse
    {
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:300']]);

        return response()->json(['data' => $stories->unpublish($id, $data['reason'] ?? null)]);
    }

    public function consent(Request $request, string $id, ManageTravelStories $stories): JsonResponse
    {
        $account = PortalAccount::of($this->user($request));

        if ($account->isPassenger()) {
            throw ApiException::forbidden('PORTAL_CUSTOMER_ONLY', 'El consentimiento lo da el titular de la reserva.');
        }

        $data = $request->validate([
            'granted' => ['required', 'boolean'],
            'name_mode' => ['nullable', 'in:'.implode(',', ManageTravelStories::NAME_MODES)],
            'photos' => ['nullable', 'boolean'],
        ], ['granted.*' => 'Indica si autorizas la publicación.', 'name_mode.*' => 'Elige cómo se muestra tu nombre.']);

        return response()->json(['data' => $stories->consent($account, $id, $data)]);
    }

    public function published(StoryDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->published()]);
    }

    public function publishedOne(string $slug, StoryDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->publishedOne($slug)]);
    }

    private function rules(bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes';

        return [
            'title' => [$required, 'string', 'min:5', 'max:200'],
            'slug' => ['nullable', 'string', 'max:160'],
            'city' => ['nullable', 'string', 'max:80'],
            'quote' => ['nullable', 'string', 'max:600'],
            'body' => ['nullable', 'string', 'max:50000'],
            'photo_count' => ['nullable', 'integer', 'between:0,60'],
            'product' => ['nullable', 'string', 'max:40'],
        ];
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
