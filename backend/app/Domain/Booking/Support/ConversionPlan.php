<?php

declare(strict_types=1);

namespace App\Domain\Booking\Support;

use App\Domain\Admin\Support\TenantSettings;
use App\Domain\Quotes\Models\Quote;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Tenancy\TenantContext;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Carbon\CarbonImmutable;
use DateTimeInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class ConversionPlan
{
    public const DEFAULT_ADVANCE_PCT = 40;

    public const DEFAULT_BALANCE_DAYS = 15;

    public function __construct(private readonly TenantContext $context, private readonly TenantSettings $settings) {}

    public function today(): CarbonImmutable
    {
        return CarbonImmutable::now($this->context->timezone())->startOfDay();
    }

    public function preview(Quote $quote): array
    {
        $today = $this->today();
        $version = DB::table('quote_versions')->where('id', $quote->current_version_id)->first();
        $items = $version ? $this->items((string) $version->id) : collect();
        $products = $this->products($items);
        $departures = $this->departures($items, $products, $today);
        $total = Decimal::round2((string) ($version->grand_total ?? '0'));
        $currency = (string) ($version->currency ?? $quote->currency);
        $availability = $this->availabilityOf($items, $products, $departures);
        $checks = $this->checks($quote, $version, $items, $products, $total, $currency);
        $blocked = collect($availability)->contains(fn (array $row): bool => $row['status'] === 'bloqueado');
        $ready = collect($checks)->every(fn (array $check): bool => $check['ok']);

        return [
            'code' => $quote->code,
            'status' => $quote->status,
            'reservation' => $quote->reservation_id ? DB::table('booking_reservations')->where('id', $quote->reservation_id)->value('code') : null,
            'version' => (int) $quote->current_version_no,
            'currency' => $currency,
            'total' => (string) $total,
            'pax' => $quote->paxTotal(),
            'checks' => $checks,
            'ready' => $ready,
            'blocked' => $blocked,
            'can_convert' => $ready && ! $blocked,
            'receivables' => array_map(fn (array $row): array => [
                'concept' => $row['concept'],
                'amount' => (string) $row['amount'],
                'due' => $row['due']->toDateString(),
            ], $this->receivables($total, $quote->travel_from, $today)),
            'items' => $availability,
        ];
    }

    public function alternatives(string $productId, int $pax, ?string $except = null): Collection
    {
        return DB::table('catalog_product_departures')
            ->where('product_id', $productId)
            ->where('departure_date', '>=', $this->today()->toDateString())
            ->when($except !== null, fn ($query) => $query->where('departure_date', '<>', $except))
            ->whereNotIn('status', ['cerrada', 'cancelada', 'completa'])
            ->whereRaw('capacity - sold >= ?', [$pax])
            ->orderBy('departure_date')
            ->limit(5)
            ->get(['ref', 'departure_date', DB::raw('capacity - sold as available')])
            ->map(fn (object $row): array => ['ref' => $row->ref, 'date' => (string) $row->departure_date, 'free' => (int) $row->available]);
    }

    private function checks(Quote $quote, ?object $version, Collection $items, Collection $products, BigDecimal $total, string $currency): array
    {
        [$pct] = $this->terms();
        $client = DB::table('crm_clients')->where('id', $quote->client_id)->whereNull('deleted_at')->first(['name']);
        $approved = $quote->status === 'aprobada';
        $versionOk = $version !== null && $version->status === 'aprobada';
        $productCount = $items->pluck('product_id')->unique()->count();
        $timezone = $this->context->timezone();
        $paxText = "{$quote->pax_adt} ".((int) $quote->pax_adt === 1 ? 'adulto' : 'adultos').", {$quote->pax_chd} ".((int) $quote->pax_chd === 1 ? 'niño' : 'niños')." y {$quote->pax_inf} ".((int) $quote->pax_inf === 1 ? 'infante' : 'infantes');
        $net = Decimal::round2((string) ($version->net_total ?? '0'));
        $fx = $currency === 'PEN' ? '' : ' al tipo de cambio '.rtrim(rtrim((string) ($version->fx_rate ?? $quote->fx_rate), '0'), '.');
        $terms = $pct >= 100 ? 'pago total' : ($pct <= 0 ? 'saldo del 100 %' : "anticipo {$pct} % y saldo ".(100 - $pct).' %');
        $from = $quote->travel_from?->format('d/m/Y');
        $to = $quote->travel_to?->format('d/m/Y');

        return [
            ['key' => 'approved', 'title' => 'Cotización aprobada por el cliente', 'ok' => $approved, 'detail' => $approved
                ? trim(($quote->approved_by_name ? "Por {$quote->approved_by_name}" : 'Aprobación registrada').($quote->approved_at ? ' el '.$quote->approved_at->setTimezone($timezone)->format('d/m/Y H:i') : '').($quote->approval_channel ? " por {$quote->approval_channel}" : '').'.')
                : 'Aún no tiene la aprobación del cliente.'],
            ['key' => 'version', 'title' => "Versión exacta {$quote->current_version_no}", 'ok' => $versionOk, 'detail' => $versionOk
                ? 'Se copia tal cual: '.($version->snapshot_label ?: 'sin foto del catálogo').'.'
                : 'La versión vigente no es la aprobada por el cliente.'],
            ['key' => 'services', 'title' => 'Servicios', 'ok' => $items->isNotEmpty(), 'detail' => $items->isEmpty()
                ? 'La versión no tiene servicios.'
                : $items->count().' '.($items->count() === 1 ? 'ítem' : 'ítems')." de {$productCount} ".($productCount === 1 ? 'producto' : 'productos').'.'],
            ['key' => 'passengers', 'title' => 'Pasajeros', 'ok' => $quote->paxTotal() > 0, 'detail' => $quote->paxTotal() > 0 ? "{$paxText}. Se crean sus fichas por completar." : 'La cotización no tiene pasajeros.'],
            ['key' => 'dates', 'title' => 'Fechas del viaje', 'ok' => $from !== null && $to !== null, 'detail' => $from !== null && $to !== null ? "Del {$from} al {$to}." : 'Faltan las fechas del viaje.'],
            ['key' => 'prices', 'title' => 'Precios', 'ok' => $total->isPositive(), 'detail' => $total->isPositive()
                ? 'Total '.Decimal::display($total, $currency).', neto '.Decimal::display($net, $currency).'.'
                : 'El total debe ser mayor que cero.'],
            ['key' => 'currency', 'title' => 'Moneda', 'ok' => $currency !== '', 'detail' => "{$currency}{$fx}."],
            ['key' => 'conditions', 'title' => 'Condiciones', 'ok' => true, 'detail' => "Políticas guardadas de {$productCount} ".($productCount === 1 ? 'producto' : 'productos')."; {$terms}."],
            ['key' => 'client', 'title' => 'Cliente válido', 'ok' => $client !== null, 'detail' => $client !== null ? "{$client->name}." : 'El cliente ya no existe en el CRM.'],
        ];
    }

    private function availabilityOf(Collection $items, Collection $products, array $departureByItem): array
    {
        $ids = array_values(array_unique(array_filter($departureByItem)));
        $departures = DB::table('catalog_product_departures')->whereIn('id', $ids ?: [''])->get(['id', 'ref', 'capacity', 'sold'])->keyBy('id');
        $needed = [];
        $rows = [];

        foreach ($items as $item) {
            $product = $products->get($item->product_id);
            $base = ['line' => (int) $item->line_no, 'product' => $product->name ?? '', 'date' => (string) $item->service_date, 'pax' => (int) $item->pax, 'alternatives' => []];

            if ($product === null || $product->status !== 'ACTIVE') {
                $rows[] = [...$base, 'ok' => false, 'status' => 'bloqueado', 'note' => 'El producto ya no está activo: crea una versión sin él.'];

                continue;
            }

            if ($product->availability_model !== 'POR_SALIDA') {
                $rows[] = [...$base, 'ok' => true, 'status' => 'proveedor', 'note' => 'Se pide al proveedor y queda sujeto a su confirmación.'];

                continue;
            }

            $departure = $departures->get($departureByItem[$item->id] ?? '');

            if ($departure === null) {
                $rows[] = [...$base, 'ok' => false, 'status' => 'bloqueado', 'note' => 'No hay salida programada en esa fecha.', 'alternatives' => $this->alternatives((string) $item->product_id, (int) $item->pax, (string) $item->service_date)->all()];

                continue;
            }

            $needed[$departure->id] = ($needed[$departure->id] ?? 0) + (int) $item->pax;
            $free = (int) $departure->capacity - (int) $departure->sold;
            $ok = $free >= $needed[$departure->id];
            $rows[] = [...$base, 'ok' => $ok, 'status' => $ok ? 'disponible' : 'bloqueado', 'departure' => $departure->ref,
                'note' => $ok ? "Salida {$departure->ref}: quedan {$free} de {$departure->capacity} cupos." : "Salida {$departure->ref}: solo quedan ".max(0, $free).' cupos.',
                'alternatives' => $ok ? [] : $this->alternatives((string) $item->product_id, (int) $item->pax, (string) $item->service_date)->all()];
        }

        return $rows;
    }

    public function items(string $versionId): Collection
    {
        return DB::table('quote_items')->where('quote_version_id', $versionId)->orderBy('line_no')->get();
    }

    public function products(Collection $items): Collection
    {
        return DB::table('catalog_products')->whereIn('id', $items->pluck('product_id')->unique()->values()->all())
            ->get(['id', 'code', 'name', 'status', 'availability_model', 'main_provider_id'])->keyBy('id');
    }

    public function departures(Collection $items, Collection $products, CarbonImmutable $today): array
    {
        $map = [];

        foreach ($items as $item) {
            $map[$item->id] = $products->get($item->product_id)?->availability_model === 'POR_SALIDA'
                ? DB::table('catalog_product_departures')
                    ->where('product_id', $item->product_id)
                    ->where('departure_date', $item->service_date)
                    ->where('departure_date', '>=', $today->toDateString())
                    ->whereNotIn('status', ['cerrada', 'cancelada'])
                    ->value('id')
                : null;
        }

        return $map;
    }

    public function assertAvailable(Collection $items, Collection $products, array $departureByItem, array $departures): void
    {
        $needed = [];

        foreach ($items as $item) {
            $product = $products->get($item->product_id);

            if ($product === null || $product->status !== 'ACTIVE') {
                throw ApiException::unprocessable('PRD-BR-002', 'El producto '.($product->name ?? '').' ya no está activo. Crea una nueva versión sin él.');
            }

            if ($product->availability_model !== 'POR_SALIDA') {
                continue;
            }

            $departureId = $departureByItem[$item->id] ?? null;
            if ($departureId === null) {
                throw $this->noAvailability($item, "{$product->name} no tiene salida programada el {$item->service_date}.");
            }

            $needed[$departureId] = ($needed[$departureId] ?? 0) + (int) $item->pax;
            $departure = $departures[$departureId];

            if ((int) $departure->capacity - (int) $departure->sold < $needed[$departureId]) {
                throw $this->noAvailability($item, "La salida {$departure->ref} de {$product->name} no tiene {$needed[$departureId]} cupos libres.");
            }
        }
    }

    public function receivables(BigDecimal $total, DateTimeInterface $travelFrom, CarbonImmutable $today): array
    {
        [$pct, $days] = $this->terms();
        $from = CarbonImmutable::parse($travelFrom->format('Y-m-d'), $today->getTimezone())->startOfDay();
        $soon = $today->addDays(3)->min($from->max($today));
        $balanceDue = $from->subDays($days)->max($today);

        if ($pct >= 100) {
            return [['kind' => 'total', 'concept' => 'Pago total', 'amount' => $total, 'due' => $soon]];
        }

        if ($pct <= 0) {
            return [['kind' => 'saldo', 'concept' => 'Saldo 100%', 'amount' => $total, 'due' => $balanceDue]];
        }

        $deposit = Decimal::round2($total->multipliedBy($pct)->dividedBy(100, 6, RoundingMode::HALF_UP));

        return [
            ['kind' => 'anticipo', 'concept' => "Anticipo {$pct}%", 'amount' => $deposit, 'due' => $soon],
            ['kind' => 'saldo', 'concept' => 'Saldo '.(100 - $pct).'%', 'amount' => $total->minus($deposit), 'due' => $balanceDue],
        ];
    }

    public function terms(): array
    {
        $policies = $this->settings->section('policies');

        return [
            (int) ($policies['advance_pct'] ?? self::DEFAULT_ADVANCE_PCT),
            (int) ($policies['balance_days_before'] ?? self::DEFAULT_BALANCE_DAYS),
        ];
    }

    private function noAvailability(object $item, string $message): ApiException
    {
        $alternatives = $this->alternatives((string) $item->product_id, (int) $item->pax)
            ->map(fn (array $row): array => ['ref' => $row['ref'], 'departure_date' => $row['date'], 'available' => $row['free']]);

        return ApiException::conflict('RT-4', $message.' No se convierte a medias: crea una nueva versión con otra fecha.', [
            'quote_item_id' => $item->id,
            'alternatives' => $alternatives,
        ]);
    }
}
