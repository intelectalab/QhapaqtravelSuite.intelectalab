<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Http\Controllers;

use App\Domain\Catalog\Actions\AvailabilityRegistry;
use App\Domain\Catalog\Actions\DepartureRegistry;
use App\Domain\Catalog\Http\Controllers\Concerns\ResolvesActor;
use App\Domain\Catalog\Http\Controllers\Concerns\ResolvesProduct;
use App\Domain\Catalog\Support\AvailabilityDirectory;
use App\Domain\Catalog\Support\CatalogAccess;
use App\Domain\Catalog\Support\DepartureDirectory;
use App\Domain\Catalog\Support\ProductAvailability;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Http\CursorPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

final class ScheduleController
{
    use ResolvesActor;
    use ResolvesProduct;

    private const DEPARTURE_SORTS = ['date' => 'd.departure_date', 'time' => 'd.departure_time', 'ref' => 'd.ref', 'status' => 'd.status', 'capacity' => 'd.capacity', 'sold' => 'd.sold'];

    private const HOLD_SORTS = ['created_at' => 'h.created_at', 'expires_at' => 'h.expires_at', 'ref' => 'h.ref', 'status' => 'h.status', 'quantity' => 'h.quantity'];

    private const RANGE_SORTS = ['date_from' => 'r.date_from', 'date_to' => 'r.date_to', 'code' => 'r.code', 'status' => 'r.status'];

    public function departure(DepartureDirectory $directory, string $ref): JsonResponse
    {
        return response()->json(['data' => $directory->find($ref)]);
    }

    public function holds(Request $request): JsonResponse
    {
        $filters = CursorPage::filters($request);
        $now = now();
        $query = AvailabilityDirectory::holdsQuery()
            ->when($filters['status'] ?? null, fn ($builder, string $status) => $builder->whereIn('h.status', explode(',', $status)))
            ->when($filters['departure'] ?? null, fn ($builder, string $ref) => $builder->where('d.ref', $ref))
            ->when($filters['product'] ?? null, fn ($builder, string $code) => $builder->where('p.code', $code))
            ->when($filters['reference'] ?? null, fn ($builder, string $reference) => $builder->where('h.reference', 'ilike', '%'.addcslashes($reference, '%_\\').'%'));

        return response()->json(CursorPage::respond($request, $query, self::HOLD_SORTS, '-created_at,ref', fn (object $hold) => AvailabilityDirectory::presentHold($hold, $now)));
    }

    public function productDepartures(Request $request, string $product): JsonResponse
    {
        $productId = $this->productId($product);
        $filters = CursorPage::filters($request);
        $today = CatalogAccess::today();
        $held = DepartureDirectory::heldByDeparture($productId);
        $query = DepartureDirectory::query()->where('d.product_id', $productId)
            ->when($filters['status'] ?? null, fn ($builder, string $status) => $builder->whereIn('d.status', explode(',', $status)))
            ->when($filters['from'] ?? null, fn ($builder, string $from) => $builder->where('d.departure_date', '>=', $this->date($from, 'filter.from')))
            ->when($filters['to'] ?? null, fn ($builder, string $to) => $builder->where('d.departure_date', '<=', $this->date($to, 'filter.to')))
            ->when(($filters['future'] ?? null) === 'true', fn ($builder) => $builder->where('d.departure_date', '>=', $today));

        return response()->json(CursorPage::respond($request, $query, self::DEPARTURE_SORTS, 'date,time,ref', fn (object $row) => DepartureDirectory::present($row, (int) ($held[$row->id] ?? 0), $today)));
    }

    public function storeDeparture(Request $request, DepartureRegistry $registry, DepartureDirectory $directory, string $product): JsonResponse
    {
        $created = $registry->create([...DepartureController::payload($request, true, false), 'product_id' => $this->productId($product)], $this->actor($request));

        return response()->json(['data' => $directory->find($created['ref']), 'meta' => ['warning' => $created['warning']]], 201);
    }

    public function updateDeparture(Request $request, DepartureRegistry $registry, DepartureDirectory $directory, string $product, string $departure): JsonResponse
    {
        $ref = $this->ownedDeparture($product, $departure);
        $updated = $registry->update($ref, DepartureController::payload($request, false), (int) $request->input('lock_version'), $this->actor($request));

        return response()->json(['data' => $directory->find($updated['ref']), 'meta' => ['warning' => $updated['warning']]]);
    }

    public function availability(Request $request, ProductAvailability $availability, string $product): JsonResponse
    {
        $productId = $this->productId($product);
        $data = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'seats' => ['nullable', 'integer', 'between:1,60'],
        ], [
            'from.*' => 'Indica la fecha inicial en formato AAAA-MM-DD.',
            'to.after_or_equal' => 'La fecha final debe ser igual o posterior a la inicial.',
            'to.*' => 'Indica la fecha final en formato AAAA-MM-DD.',
            'seats.*' => 'Los cupos van de 1 a 60.',
        ]);
        $from = $data['from'] ?? CatalogAccess::today();
        $to = $data['to'] ?? Carbon::parse($from)->addDays(30)->toDateString();

        if (Carbon::parse($from)->diffInDays(Carbon::parse($to)) >= ProductAvailability::MAX_DAYS) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'Consulta como máximo '.ProductAvailability::MAX_DAYS.' días por llamada.', ['to' => ['Consulta como máximo '.ProductAvailability::MAX_DAYS.' días por llamada.']]);
        }

        return response()->json(['data' => $availability->days($productId, $from, $to, (int) ($data['seats'] ?? 1))]);
    }

    public function ranges(Request $request, string $product): JsonResponse
    {
        $productId = $this->productId($product);
        $filters = CursorPage::filters($request);
        $today = CatalogAccess::today();
        $query = AvailabilityDirectory::rangesQuery()->where('r.product_id', $productId)
            ->when($filters['status'] ?? null, fn ($builder, string $status) => $builder->whereIn('r.status', explode(',', $status)))
            ->when($filters['from'] ?? null, fn ($builder, string $from) => $builder->where('r.date_to', '>=', $this->date($from, 'filter.from')))
            ->when($filters['to'] ?? null, fn ($builder, string $to) => $builder->where('r.date_from', '<=', $this->date($to, 'filter.to')));

        return response()->json(CursorPage::respond($request, $query, self::RANGE_SORTS, 'date_from,code', fn (object $range) => AvailabilityDirectory::presentRange($range, $today)));
    }

    public function closeDates(Request $request, AvailabilityRegistry $registry, string $product): JsonResponse
    {
        $data = $request->validate([
            'dates' => ['required', 'array', 'min:1', 'max:366'],
            'dates.*' => ['required', 'date_format:Y-m-d'],
            'status' => ['required', Rule::in(['cerrado', 'agotado'])],
            'note' => ['nullable', 'string', 'max:200'],
            'confirm_sales' => ['nullable', 'boolean'],
        ], [
            'dates.*' => 'Elige entre 1 y 366 fechas en formato AAAA-MM-DD.',
            'status.*' => 'Elige si las fechas quedan cerradas o agotadas.',
            'note.*' => 'La nota admite hasta 200 caracteres.',
            'confirm_sales.*' => 'Indica si confirmas el cierre con ventas.',
        ]);
        $data['confirm_sales'] = $request->boolean('confirm_sales') || $request->query('confirm_sales') === 'true';

        return response()->json(['data' => $registry->closeDates($this->productId($product), $data, $this->actor($request))], 201);
    }

    private function ownedDeparture(string $product, string $departure): string
    {
        $ref = DB::table('catalog_product_departures')->where('product_id', $this->productId($product))
            ->where(preg_match('/^[0-9a-f-]{36}$/i', $departure) === 1 ? 'id' : 'ref', $departure)->value('ref');

        return $ref !== null ? (string) $ref : throw ApiException::notFound('La salida no existe.');
    }

    private function date(string $value, string $field): string
    {
        $date = Carbon::hasFormat($value, 'Y-m-d') ? $value : null;

        return $date ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'La fecha debe tener el formato AAAA-MM-DD.', [$field => ['La fecha debe tener el formato AAAA-MM-DD.']]);
    }
}
