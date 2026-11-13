<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Http\Controllers;

use App\Domain\Catalog\Actions\ProductSections;
use App\Domain\Catalog\Actions\ProductWorkflow;
use App\Domain\Catalog\Http\Controllers\Concerns\ResolvesActor;
use App\Domain\Catalog\Http\Requests\ProductSaveRequest;
use App\Domain\Catalog\Support\ProductEditorState;
use App\Domain\Catalog\Support\ProductOverview;
use App\Domain\Catalog\Support\ProductSectionRules;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ProductEditorController
{
    use ResolvesActor;

    public function __construct(private readonly ProductSections $sections, private readonly ProductEditorState $state) {}

    public function show(Request $request, string $code): JsonResponse
    {
        return response()->json(['data' => $this->state($request, $code)]);
    }

    public function overview(Request $request, string $code, ProductOverview $overview): JsonResponse
    {
        return response()->json(['data' => $overview->find($code, $this->actor($request)) ?? throw ApiException::notFound('El producto no existe.')]);
    }

    public function preview(ProductSaveRequest $request, ProductWorkflow $workflow): JsonResponse
    {
        return response()->json(['data' => $workflow->preview($request->validated(), $request->step(), $this->actor($request))]);
    }

    public function mainProvider(Request $request, string $code): JsonResponse
    {
        $data = $this->validated($request, ['main_provider_id' => ['nullable', 'uuid'], 'reason' => ['nullable', 'string', 'min:3', 'max:300']]);

        return $this->save($request, $code, fn (object $product) => $this->sections->mainProvider($product, $data['main_provider_id'] ?? null, $this->actor($request), $data['reason'] ?? null));
    }

    public function components(Request $request, string $code): JsonResponse
    {
        $data = $this->validated($request, ['main_provider_id' => ['nullable', 'uuid'], ...ProductSectionRules::components()]);

        return $this->save($request, $code, function (object $product) use ($request, $data): void {
            if ($request->exists('main_provider_id')) {
                $this->sections->mainProvider($product, $data['main_provider_id'] ?? null, $this->actor($request));
                $product->main_provider_id = $data['main_provider_id'] ?? null;
            }

            $this->sections->components($product, $data['components'], $this->actor($request));
        });
    }

    public function storeComponent(Request $request, string $code): JsonResponse
    {
        $data = $this->element($request, ProductSectionRules::component('component'), 'component');

        return $this->save($request, $code, fn (object $product) => $this->sections->components($product, [...$this->sections->currentComponents($product->id), $data], $this->actor($request)), 201);
    }

    public function updateComponent(Request $request, string $code, string $component): JsonResponse
    {
        $data = $this->element($request, ProductSectionRules::component('component', true), 'component');

        return $this->save($request, $code, function (object $product) use ($request, $component, $data): void {
            $list = $this->sections->currentComponents($product->id);
            $index = $this->position($list, $component, 'El componente no existe.');
            $list[$index] = [...$list[$index], ...$data];
            if (array_key_exists('service_id', $data) || array_key_exists('component_product_id', $data)) {
                $list[$index]['service_id'] = $data['service_id'] ?? null;
                $list[$index]['component_product_id'] = $data['component_product_id'] ?? null;
            }
            $this->sections->components($product, $list, $this->actor($request));
        });
    }

    public function destroyComponent(Request $request, string $code, string $component): Response
    {
        return $this->remove($request, $code, function (object $product) use ($request, $component): void {
            $list = $this->sections->currentComponents($product->id);
            unset($list[$this->position($list, $component, 'El componente no existe.')]);
            $this->sections->components($product, array_values($list), $this->actor($request));
        });
    }

    public function itinerary(Request $request, string $code): JsonResponse
    {
        $data = $this->validated($request, ProductSectionRules::itinerary());

        return $this->save($request, $code, fn (object $product) => $this->sections->itinerary($product, $data['itinerary'], $this->actor($request)));
    }

    public function storeDay(Request $request, string $code, string $itinerary): JsonResponse
    {
        $data = $this->element($request, ProductSectionRules::day('day'), 'day');

        return $this->save($request, $code, function (object $product) use ($request, $itinerary, $data): void {
            $this->ensureItinerary($product, $itinerary);
            $this->sections->itinerary($product, [...$this->sections->currentItinerary($product->id), [...$data, 'items' => $data['items'] ?? []]], $this->actor($request));
        }, 201);
    }

    public function updateDay(Request $request, string $code, string $itinerary, string $day): JsonResponse
    {
        $data = $this->element($request, ['day.title' => ['required', 'string', 'min:3', 'max:160']], 'day');

        return $this->save($request, $code, function (object $product) use ($request, $itinerary, $day, $data): void {
            $this->ensureItinerary($product, $itinerary);
            $days = $this->sections->currentItinerary($product->id);
            $days[$this->position($days, $day, 'El día no existe.')]['title'] = $data['title'];
            $this->sections->itinerary($product, $days, $this->actor($request));
        });
    }

    public function destroyDay(Request $request, string $code, string $itinerary, string $day): Response
    {
        return $this->remove($request, $code, function (object $product) use ($request, $itinerary, $day): void {
            $this->ensureItinerary($product, $itinerary);
            $days = $this->sections->currentItinerary($product->id);
            unset($days[$this->position($days, $day, 'El día no existe.')]);
            $this->sections->itinerary($product, array_values($days), $this->actor($request));
        });
    }

    public function storeItem(Request $request, string $code, string $itinerary, string $day): JsonResponse
    {
        $data = $this->element($request, ProductSectionRules::item('item'), 'item');

        return $this->save($request, $code, function (object $product) use ($request, $itinerary, $day, $data): void {
            $this->ensureItinerary($product, $itinerary);
            $days = $this->sections->currentItinerary($product->id);
            $days[$this->position($days, $day, 'El día no existe.')]['items'][] = $data;
            $this->sections->itinerary($product, $days, $this->actor($request));
        }, 201);
    }

    public function updateItem(Request $request, string $code, string $itinerary, string $day, string $item): JsonResponse
    {
        $data = $this->element($request, ProductSectionRules::item('item', true), 'item');

        return $this->save($request, $code, function (object $product) use ($request, $itinerary, $day, $item, $data): void {
            $this->ensureItinerary($product, $itinerary);
            $days = $this->sections->currentItinerary($product->id);
            $dayIndex = $this->position($days, $day, 'El día no existe.');
            $itemIndex = $this->position($days[$dayIndex]['items'], $item, 'La actividad no existe.');
            $days[$dayIndex]['items'][$itemIndex] = [...$days[$dayIndex]['items'][$itemIndex], ...$data];
            $this->sections->itinerary($product, $days, $this->actor($request));
        });
    }

    public function destroyItem(Request $request, string $code, string $itinerary, string $day, string $item): Response
    {
        return $this->remove($request, $code, function (object $product) use ($request, $itinerary, $day, $item): void {
            $this->ensureItinerary($product, $itinerary);
            $days = $this->sections->currentItinerary($product->id);
            $dayIndex = $this->position($days, $day, 'El día no existe.');
            $items = $days[$dayIndex]['items'];
            unset($items[$this->position($items, $item, 'La actividad no existe.')]);
            $days[$dayIndex]['items'] = array_values($items);
            $this->sections->itinerary($product, $days, $this->actor($request));
        });
    }

    public function seasons(Request $request, string $code): JsonResponse
    {
        $data = $this->validated($request, ProductSectionRules::seasons());

        return $this->save($request, $code, fn (object $product) => $this->sections->seasons($product, $data['season_ids'], $this->actor($request)));
    }

    public function storeSeason(Request $request, string $code): JsonResponse
    {
        $data = $request->validate(['season_id' => ['required', 'uuid']], ['season_id.*' => 'Elige una temporada válida.']);

        return $this->save($request, $code, function (object $product) use ($request, $data): void {
            $current = DB::table('catalog_product_seasons')->where('product_id', $product->id)->pluck('season_id')->all();
            if (in_array($data['season_id'], $current, true)) {
                throw ApiException::conflict('CAT-BR-13', 'La temporada ya está asociada a este producto.');
            }
            $this->sections->seasons($product, [...$current, $data['season_id']], $this->actor($request));
        }, 201);
    }

    public function destroySeason(Request $request, string $code, string $season): Response
    {
        return $this->remove($request, $code, function (object $product) use ($request, $season): void {
            $id = Str::isUuid($season) ? $season : (string) DB::table('catalog_seasons')->where('ref', $season)->value('id');
            $this->sections->removeSeason($product, $id, $this->actor($request));
        });
    }

    public function availability(Request $request, string $code): JsonResponse
    {
        $data = $this->validated($request, ProductSectionRules::availability());

        return $this->save($request, $code, fn (object $product) => $this->sections->availability($product, $data, $this->actor($request)));
    }

    public function content(Request $request, string $code): JsonResponse
    {
        $data = $this->validated($request, ProductSectionRules::content());

        return $this->save($request, $code, fn (object $product) => $this->sections->content($product, $data, $this->actor($request)));
    }

    public function policies(Request $request, string $code): JsonResponse
    {
        $data = $this->validated($request, ProductSectionRules::policies());

        return $this->save($request, $code, fn (object $product) => $this->sections->policies($product, $data, $this->actor($request)));
    }

    public function channels(Request $request, string $code): JsonResponse
    {
        $data = $this->validated($request, ProductSectionRules::channels());

        return $this->save($request, $code, fn (object $product) => $this->sections->channels($product, $data['channels'], $this->actor($request)));
    }

    public function publishChannel(Request $request, string $code, string $channel): JsonResponse
    {
        $data = $request->validate(['published' => ['required', 'boolean']], ['published.*' => 'Indica si el canal queda publicado.']);

        return $this->save($request, $code, fn (object $product) => $this->sections->publishChannel($product, $channel, (bool) $data['published'], $this->actor($request)));
    }

    private function validated(Request $request, array $rules): array
    {
        return $request->validate([...$rules, 'lock_version' => ['required', 'integer']], ProductSectionRules::messages());
    }

    private function element(Request $request, array $rules, string $key): array
    {
        $request->merge([$key => $request->except(['lock_version', $key])]);
        $fields = array_map(fn (string $field) => substr($field, strlen($key) + 1), array_filter(array_keys($rules), fn (string $field) => substr_count($field, '.') === 1));
        $data = $request->validate([$key => ['array'], ...$rules], $this->messagesFor($key))[$key] ?? [];

        return array_intersect_key($data, array_flip($fields));
    }

    private function messagesFor(string $key): array
    {
        $messages = [];
        foreach (ProductSectionRules::messages() as $pattern => $message) {
            foreach (['components.*.' => 'component.', 'itinerary.*.items.*.' => 'item.', 'itinerary.*.' => 'day.'] as $from => $to) {
                if (str_starts_with($pattern, $from) && str_starts_with($to, $key)) {
                    $messages[$to.substr($pattern, strlen($from))] = $message;
                }
            }
        }

        return $messages;
    }

    private function position(array $list, string $id, string $missing): int
    {
        foreach ($list as $index => $row) {
            if (($row['id'] ?? null) === $id) {
                return $index;
            }
        }

        throw ApiException::notFound($missing);
    }

    private function ensureItinerary(object $product, string $itinerary): void
    {
        $current = $this->sections->itineraryId($product->id);

        if ($itinerary !== 'principal' && $itinerary !== $current) {
            throw ApiException::notFound('El itinerario no existe.');
        }
    }

    private function lock(Request $request): ?int
    {
        $value = $request->input('lock_version') ?? $request->header('If-Match');

        return $value === null || $value === '' ? null : (int) trim((string) $value, 'W/" ');
    }

    private function save(Request $request, string $code, callable $work, int $status = 200): JsonResponse
    {
        $this->sections->edit($code, $this->lock($request), $this->actor($request), $work);

        return response()->json(['data' => $this->state($request, $code)], $status);
    }

    private function remove(Request $request, string $code, callable $work): Response
    {
        $this->sections->edit($code, $this->lock($request), $this->actor($request), $work);

        return response()->noContent();
    }

    private function state(Request $request, string $code): array
    {
        return $this->state->find($code, $this->actor($request)) ?? throw ApiException::notFound('El producto no existe.');
    }
}
