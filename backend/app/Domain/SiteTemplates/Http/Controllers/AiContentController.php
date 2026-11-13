<?php

declare(strict_types=1);

namespace App\Domain\SiteTemplates\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\SiteTemplates\Actions\AiContent;
use App\Domain\SiteTemplates\Support\AiCredits;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

final class AiContentController
{
    public function jobs(Request $request, AiContent $content): JsonResponse
    {
        $filters = $request->validate([
            'kind' => ['nullable', Rule::in(array_keys(AiContent::KINDS))],
            'status' => ['nullable', Rule::in(array_keys(AiContent::STATUSES))],
            'filter.kind' => ['nullable', Rule::in(array_keys(AiContent::KINDS))],
            'filter.status' => ['nullable', Rule::in(array_keys(AiContent::STATUSES))],
        ]);
        $items = $content->list(['kind' => $filters['kind'] ?? ($filters['filter']['kind'] ?? null), 'status' => $filters['status'] ?? ($filters['filter']['status'] ?? null)]);

        return response()->json(['data' => $items, 'meta' => ['total' => count($items), 'options' => $content->options()]]);
    }

    public function show(string $code, AiContent $content): JsonResponse
    {
        return response()->json(['data' => $content->show($code)]);
    }

    public function store(Request $request, AiContent $content): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', Rule::in(array_keys(AiContent::KIND_TARGETS))],
            'target_type' => ['required', Rule::in(['producto', 'pagina', 'historia', 'libre'])],
            'target_id' => ['nullable', 'string', 'max:300'],
            'tone' => ['nullable', Rule::in(array_keys(AiContent::TONES))],
            'locale' => ['nullable', Rule::in(array_keys(AiContent::LOCALES))],
            'notes' => ['nullable', 'string', 'max:1000'],
        ], [
            'kind.required' => 'Elija qué necesita.',
            'kind.in' => 'Ese tipo de pedido no existe.',
            'target_type.required' => 'Elija sobre qué quiere el contenido.',
            'notes.max' => 'Las indicaciones admiten hasta 1 000 caracteres.',
        ]);

        return response()->json(['data' => $content->create($data, $this->user($request))], 202);
    }

    public function apply(string $code, Request $request, AiContent $content): JsonResponse
    {
        return response()->json(['data' => $content->apply($code, $this->user($request))]);
    }

    public function discard(string $code, AiContent $content): JsonResponse
    {
        return response()->json(['data' => $content->discard($code)]);
    }

    public function regenerate(string $code, Request $request, AiContent $content): JsonResponse
    {
        return response()->json(['data' => $content->regenerate($code, $this->user($request))], 202);
    }

    public function images(AiContent $content, AiCredits $credits): JsonResponse
    {
        $items = $content->images();

        return response()->json(['data' => $items, 'meta' => ['total' => count($items), 'balance' => $credits->balance('imagenes')]]);
    }

    public function storeImages(Request $request, AiContent $content): JsonResponse
    {
        $data = $request->validate([
            'prompt' => ['required', 'string', 'min:10', 'max:2000'],
            'style' => ['required', Rule::in(array_keys(AiContent::STYLES))],
            'count' => ['required', 'integer', Rule::in(AiContent::IMAGE_COUNTS)],
            'quality' => ['required', Rule::in(array_keys(AiContent::QUALITIES))],
        ], [
            'prompt.required' => 'Describa la imagen.',
            'prompt.min' => 'Describa la imagen con al menos 10 caracteres.',
            'prompt.max' => 'La descripción admite hasta 2 000 caracteres.',
            'style.in' => 'Ese estilo no existe.',
            'count.in' => 'Puede crear 1, 2 o 4 imágenes por pedido.',
            'quality.in' => 'Elija calidad estándar o HD.',
        ]);

        return response()->json(['data' => $content->createImages($data, $this->user($request))], 202);
    }

    public function updateImage(string $id, Request $request, AiContent $content): JsonResponse
    {
        $data = $request->validate([
            'alt_text' => ['nullable', 'string', 'min:5', 'max:200', Rule::requiredIf(fn (): bool => $request->input('action') === null)],
            'action' => ['nullable', Rule::in(['usar', 'descartar'])],
            'used_in' => ['nullable', Rule::requiredIf(fn (): bool => $request->input('action') === 'usar'), Rule::in(AiContent::IMAGE_USES)],
        ], [
            'alt_text.required' => 'Escriba el texto alternativo de la imagen.',
            'alt_text.min' => 'El texto alternativo necesita al menos 5 caracteres.',
            'alt_text.max' => 'El texto alternativo admite hasta 200 caracteres.',
            'used_in.required' => 'Elija dónde usará la imagen.',
            'used_in.in' => 'Ese uso no está disponible.',
        ]);

        return response()->json(['data' => $content->updateImage($id, $data)]);
    }

    public function imageFile(string $id, AiContent $content): Response
    {
        $image = $content->imageFile($id);
        abort_if($image === null, 404);
        $path = (string) $image->file_path;

        return response((string) Storage::disk((string) config('filesystems.default'))->get($path), 200, [
            'Content-Type' => str_ends_with($path, '.svg') ? 'image/svg+xml' : 'image/png',
            'Content-Security-Policy' => "default-src 'none'; style-src 'unsafe-inline'",
            'Cache-Control' => 'private, max-age=86400',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function credits(AiCredits $credits): JsonResponse
    {
        return response()->json(['data' => $credits->summary()]);
    }

    public function ledger(AiCredits $credits): JsonResponse
    {
        $items = $credits->ledger();

        return response()->json(['data' => $items, 'meta' => ['total' => count($items)]]);
    }

    public function packs(AiCredits $credits): JsonResponse
    {
        $packs = $credits->packs()->map($credits->presentPack(...))->values();

        return response()->json(['data' => ['plans' => $packs->where('is_plan', true)->values()->all(), 'packs' => $packs->where('is_plan', false)->values()->all(), 'contracted' => $credits->contractedPlan()?->code, 'plan_included' => $credits->summary()['plan_included']]]);
    }

    public function purchasePack(string $code, Request $request, AiContent $content): JsonResponse
    {
        return response()->json(['data' => $content->purchasePack($code, $this->user($request))]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
