<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Http\Controllers;

use App\Domain\Catalog\Actions\ExportProductCatalog;
use App\Domain\Catalog\Actions\ProductSubresources;
use App\Domain\Catalog\Http\Controllers\Concerns\ResolvesActor;
use App\Domain\Catalog\Support\ProductEditorState;
use App\Domain\Catalog\Support\ProductOverview;
use App\Domain\Catalog\Support\ProductSectionRules;
use App\Domain\Catalog\Support\ProductSubresourceViews;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Http\CursorPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

final class ProductSubresourceController
{
    use ResolvesActor;

    public function __construct(private readonly ProductSubresourceViews $views, private readonly ProductSubresources $subresources) {}

    public function kpis(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->views->kpis($this->actor($request))]);
    }

    public function export(Request $request, ExportProductCatalog $export): JsonResponse
    {
        return response()->json(['data' => $export(array_intersect_key(CursorPage::filters($request), array_flip(ExportProductCatalog::FILTERS)))]);
    }

    public function usage(Request $request, string $id, ProductOverview $overview): JsonResponse
    {
        $product = $this->views->product($id);
        $data = $overview->find($product->code, $this->actor($request)) ?? throw ApiException::notFound('El producto no existe.');

        return response()->json(['data' => ['code' => $product->code, 'quotes_count' => $data['kpis']['quotes'], 'reservations_count' => $data['kpis']['reservations'], ...$data['usage']]]);
    }

    public function audit(Request $request, string $id): JsonResponse
    {
        return response()->json($this->views->audit($request, $this->views->product($id)));
    }

    public function content(string $id): JsonResponse
    {
        return response()->json(['data' => $this->views->content($this->views->product($id))]);
    }

    public function components(Request $request, string $id, ProductEditorState $state): JsonResponse
    {
        $data = $this->editorState($request, $id, $state);

        return response()->json(['data' => $data['components'], 'meta' => ['code' => $data['code'], 'lock_version' => $data['lock_version'], 'main_provider_id' => $data['main_provider_id']]]);
    }

    public function itineraries(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => $this->views->itineraries($this->views->product($id), $this->actor($request))]);
    }

    public function policies(Request $request, string $id, ProductEditorState $state): JsonResponse
    {
        $data = $this->editorState($request, $id, $state);

        return response()->json(['data' => $data['policies'], 'meta' => ['code' => $data['code'], 'lock_version' => $data['lock_version']]]);
    }

    public function inclusions(Request $request, string $id): JsonResponse
    {
        $kind = $request->query('kind', CursorPage::filters($request)['kind'] ?? null);

        return response()->json(['data' => $this->views->inclusions($this->views->product($id), is_string($kind) && $kind !== '' ? $kind : null)]);
    }

    public function related(string $id): JsonResponse
    {
        $views = $this->views->related($this->views->product($id));

        return response()->json(['data' => $views['related'], 'meta' => ['referenced_by' => $views['referenced_by']]]);
    }

    public function configGroups(string $id): JsonResponse
    {
        return response()->json(['data' => $this->views->configGroups($this->views->product($id))]);
    }

    public function channels(string $id): JsonResponse
    {
        $product = $this->views->product($id);

        return response()->json(['data' => $this->views->channels($product), 'meta' => ['code' => $product->code, 'status' => $product->status]]);
    }

    public function storeRequirement(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'category' => ['nullable', Rule::in(ProductSectionRules::REQUIREMENT_CATEGORIES)],
            'text' => ['required', 'string', 'min:2', 'max:250'],
        ], ['category.*' => 'Elige la categoría del requisito.', 'text.*' => 'Describe el requisito (de 2 a 250 caracteres).']);

        return $this->created($id, fn (string $code) => $this->subresources->addRequirement($code, $this->lock($request), $this->actor($request), $data),
            fn (object $product, string $new) => collect($this->views->requirements($product))->firstWhere('id', $new));
    }

    public function destroyRequirement(Request $request, string $id, string $reqId): Response
    {
        $this->subresources->removeRequirement($this->code($id), $this->lock($request), $this->actor($request), $reqId);

        return response()->noContent();
    }

    public function storeInclusion(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', Rule::in(array_keys(ProductSubresources::KIND_LABELS))],
            'text' => ['required', 'string', 'min:2', 'max:200'],
        ], ['kind.*' => 'Indica si la línea va en «Incluye» (include) o «No incluye» (exclude).', 'text.*' => 'Cada línea lleva de 2 a 200 caracteres.']);

        return $this->created($id, fn (string $code) => $this->subresources->addInclusion($code, $this->lock($request), $this->actor($request), $data),
            fn (object $product, string $new) => collect($this->views->inclusions($product, null))->firstWhere('id', $new));
    }

    public function destroyInclusion(Request $request, string $id, string $incId): Response
    {
        $this->subresources->removeInclusion($this->code($id), $this->lock($request), $this->actor($request), $incId);

        return response()->noContent();
    }

    public function storeFaq(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'question' => ['required', 'string', 'min:5', 'max:250'],
            'answer' => ['required', 'string', 'min:2', 'max:2000'],
        ], ['question.*' => 'Escribe la pregunta (al menos 5 letras).', 'answer.*' => 'Escribe la respuesta.']);

        return $this->created($id, fn (string $code) => $this->subresources->addFaq($code, $this->lock($request), $this->actor($request), $data),
            fn (object $product, string $new) => DB::table('catalog_product_faqs')->where('id', $new)->first(['id', 'question', 'answer', 'sort_order']));
    }

    public function destroyFaq(Request $request, string $id, string $faqId): Response
    {
        $this->subresources->removeFaq($this->code($id), $this->lock($request), $this->actor($request), $faqId);

        return response()->noContent();
    }

    public function storeMedia(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'url' => ['required', 'url', 'max:400'],
            'alt_text' => ['required', 'string', 'min:3', 'max:200'],
            'is_main' => ['nullable', 'boolean'],
        ], ['url.*' => 'Escribe el enlace de la imagen.', 'alt_text.*' => 'Describe la imagen en al menos 3 letras.', 'is_main.*' => 'Indica si es la portada.']);
        $data['is_main'] = $request->boolean('is_main');

        return $this->created($id, fn (string $code) => $this->subresources->addMedia($code, $this->lock($request), $this->actor($request), $data),
            fn (object $product, string $new) => collect($this->views->media($product))->firstWhere('id', $new));
    }

    public function updateMedia(Request $request, string $id, string $mediaId): JsonResponse
    {
        $data = $request->validate([
            'alt_text' => ['sometimes', 'required', 'string', 'min:3', 'max:200'],
            'is_main' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:1', 'max:99'],
        ], ['alt_text.*' => 'Describe la imagen en al menos 3 letras.', 'is_main.*' => 'Indica si es la portada.', 'sort_order.*' => 'La posición va de 1 a 99.']);

        if ($data === []) {
            throw ApiException::unprocessable('VALIDATION_FAILED', 'Envía la descripción, la posición o si es la portada.');
        }
        if (array_key_exists('is_main', $data)) {
            $data['is_main'] = $request->boolean('is_main');
        }

        $code = $this->code($id);
        $this->subresources->updateMedia($code, $this->lock($request), $this->actor($request), $mediaId, $data);
        $product = $this->views->product($code);

        return response()->json(['data' => collect($this->views->media($product))->firstWhere('id', $mediaId), 'meta' => ['lock_version' => (int) $product->lock_version]]);
    }

    public function destroyMedia(Request $request, string $id, string $mediaId): Response
    {
        $this->subresources->removeMedia($this->code($id), $this->lock($request), $this->actor($request), $mediaId);

        return response()->noContent();
    }

    public function storeRelated(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'related_product_id' => ['required', 'string', 'max:60'],
            'relation' => ['required', Rule::in(ProductSubresources::RELATIONS)],
        ], ['related_product_id.*' => 'Elige el producto relacionado.', 'relation.*' => 'Elige el tipo de relación: '.implode(', ', ProductSubresources::RELATIONS).'.']);

        return $this->created($id, fn (string $code) => $this->subresources->relate($code, $this->lock($request), $this->actor($request), $data),
            fn (object $product, string $new) => collect($this->views->related($product)['related'])->firstWhere('id', $new));
    }

    public function destroyRelated(Request $request, string $id, string $relId): Response
    {
        $this->subresources->unrelate($this->code($id), $this->lock($request), $this->actor($request), $relId);

        return response()->noContent();
    }

    public function storeConfigGroup(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:60'],
            'options' => ['required', 'array', 'min:2', 'max:20'],
            'options.*.label' => ['required', 'string', 'min:1', 'max:80'],
            'options.*.price_delta' => ['nullable', 'numeric', 'min:-999999', 'max:999999'],
        ], ['name.*' => 'Escribe el nombre del grupo (hasta 60 caracteres).', 'options.min' => 'Un grupo necesita al menos 2 opciones.', 'options.*.label.*' => 'Cada opción necesita una etiqueta de hasta 80 caracteres.', 'options.*.price_delta.*' => 'La diferencia de precio debe ser un número.', 'options.*' => 'Revisa las opciones del grupo.']);

        return $this->created($id, fn (string $code) => $this->subresources->addConfigGroup($code, $this->lock($request), $this->actor($request), $data),
            fn (object $product, string $new) => collect($this->views->configGroups($product))->firstWhere('id', $new));
    }

    public function destroyConfigGroup(Request $request, string $id, string $groupId): Response
    {
        $this->subresources->removeConfigGroup($this->code($id), $this->lock($request), $this->actor($request), $groupId);

        return response()->noContent();
    }

    public function markup(Request $request, string $id): JsonResponse
    {
        $data = $request->validate(['markup_pct' => ['required', 'numeric', 'min:0', 'max:300']], ['markup_pct.*' => 'El markup de referencia va de 0 a 300 %.']);
        $code = $this->code($id);
        $this->subresources->markup($code, $this->lock($request), $this->actor($request), round((float) $data['markup_pct'], 2));
        $product = $this->views->product($code);

        return response()->json(['data' => ['code' => $product->code, 'markup_pct' => (float) $product->markup_pct, 'lock_version' => (int) $product->lock_version]]);
    }

    public function reorderComponents(Request $request, string $id, ProductEditorState $state): JsonResponse
    {
        $data = $request->validate(['ids' => ['required', 'array', 'max:60'], 'ids.*' => ['uuid', 'distinct']], ['ids.*' => 'Envía los componentes en el nuevo orden.']);
        $code = $this->code($id);
        $this->subresources->reorderComponents($code, $this->lock($request), $this->actor($request), $data['ids']);

        return $this->components($request, $code, $state);
    }

    private function editorState(Request $request, string $id, ProductEditorState $state): array
    {
        return $state->find($this->code($id), $this->actor($request)) ?? throw ApiException::notFound('El producto no existe.');
    }

    private function created(string $id, callable $work, callable $present): JsonResponse
    {
        $code = $this->code($id);
        $new = $work($code);
        $product = $this->views->product($code);

        return response()->json(['data' => $present($product, $new), 'meta' => ['code' => $product->code, 'lock_version' => (int) $product->lock_version]], 201);
    }

    private function code(string $id): string
    {
        return (string) $this->views->product($id)->code;
    }

    private function lock(Request $request): ?int
    {
        $value = $request->input('lock_version') ?? $request->header('If-Match');

        return $value === null || $value === '' ? null : (int) trim((string) $value, 'W/" ');
    }
}
