<?php

declare(strict_types=1);

namespace App\Domain\Site\Http\Controllers;

use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Site\Support\SiteCatalog;
use App\Domain\Site\Support\SiteContent;
use App\Domain\Site\Support\SitePages;
use App\Domain\Site\Support\SiteProfile;
use App\Domain\Site\Support\SiteQuote;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class SiteController
{
    public function profile(SiteProfile $profile): JsonResponse
    {
        return response()->json(['data' => $profile->show()]);
    }

    public function home(SitePages $pages): JsonResponse
    {
        return response()->json(['data' => $pages->home()]);
    }

    public function posts(SiteContent $content): JsonResponse
    {
        return response()->json(['data' => $content->posts()]);
    }

    public function post(string $slug, SiteContent $content): JsonResponse
    {
        return response()->json(['data' => $content->post($slug)]);
    }

    public function page(string $slug, SiteContent $content): JsonResponse
    {
        return response()->json(['data' => $slug === 'nosotros' ? [...$content->about(), 'slug' => 'nosotros'] : $content->page($slug)]);
    }

    public function cmsContent(string $slug, SiteContent $content): JsonResponse
    {
        return response()->json(['data' => $content->content($slug)]);
    }

    public function placement(string $placement, SiteContent $content): JsonResponse
    {
        return response()->json(['data' => $content->placement($placement)]);
    }

    public function offers(SitePages $pages): JsonResponse
    {
        return response()->json(['data' => $pages->offersPage()]);
    }

    public function destinations(SitePages $pages): JsonResponse
    {
        return response()->json(['data' => $pages->destinationsIndex()]);
    }

    public function destination(string $slug, SitePages $pages): JsonResponse
    {
        return response()->json(['data' => $pages->destination($slug)]);
    }

    public function products(Request $request, SitePages $pages): JsonResponse
    {
        $filters = $request->validate([
            'destino' => ['nullable', 'string', 'max:80'],
            'tipo' => ['nullable', 'in:'.implode(',', array_keys(SiteCatalog::KINDS))],
            'fecha' => ['nullable', 'date_format:Y-m-d'],
            'viajeros' => ['nullable', 'integer', 'min:1', 'max:40'],
            'duracion' => ['nullable', 'in:'.implode(',', array_keys(SiteCatalog::DURATIONS))],
            'precio_min' => ['nullable', 'numeric', 'min:0'],
            'precio_max' => ['nullable', 'numeric', 'min:0'],
            'categoria' => ['nullable', 'string', 'max:80'],
            'dificultad' => ['nullable', 'in:'.implode(',', array_keys(SiteCatalog::DIFFICULTIES))],
            'idioma' => ['nullable', 'in:'.implode(',', array_keys(SiteCatalog::LANGUAGES))],
            'modalidad' => ['nullable', 'in:Privado,Compartido,Grupal'],
            'orden' => ['nullable', 'in:'.implode(',', array_keys(SiteCatalog::SORTS))],
            'q' => ['nullable', 'string', 'max:80'],
        ], [
            'fecha.*' => 'La fecha no es válida.',
            'viajeros.*' => 'Indica entre 1 y 40 viajeros.',
            '*' => 'Revisa los filtros.',
        ]);

        return response()->json(['data' => $pages->listing(array_filter($filters, fn ($value) => $value !== null && $value !== ''))]);
    }

    public function product(Request $request, string $slug, SitePages $pages): JsonResponse
    {
        $pax = max(1, min(40, (int) $request->query('viajeros', '2')));

        return response()->json(['data' => $pages->product($slug, $pax)]);
    }

    public function bookingRules(RuleResolver $rules): JsonResponse
    {
        return response()->json(['data' => $rules->forTenant()->active()]);
    }

    public function currencies(SiteProfile $profile): JsonResponse
    {
        $names = ['PEN' => ['Sol peruano', 'S/'], 'USD' => ['Dólar estadounidense', 'US$'], 'EUR' => ['Euro', '€']];
        $settings = json_decode((string) DB::table('sys_settings')->where('section', 'currency')->value('values'), true) ?: [];
        $base = (string) ($settings['base_currency'] ?? 'PEN');
        $alt = (string) ($settings['alt_currency'] ?? 'USD');
        $rate = DB::table('fin_fx_rates')->where('currency_code', $alt)->orderByDesc('rate_date')->orderByDesc('effective_at')->first(['rate_pen', 'rate_date', 'effective_at']);
        $items = [];

        foreach (array_unique([$base, $alt]) as $code) {
            $items[] = ['code' => $code, 'name' => $names[$code][0] ?? $code, 'symbol' => $names[$code][1] ?? $code, 'base' => $code === $base, 'charge' => true, 'rate' => $code === $base ? 1.0 : ($code === 'USD' ? $profile->usdRate() : ($rate ? (float) $rate->rate_pen : null))];
        }

        return response()->json(['data' => [
            'items' => $items,
            'charge_currencies' => array_column(array_filter($items, fn (array $item): bool => $item['charge']), 'code'),
            'rate_updated_at' => $rate === null ? null : ($rate->effective_at ?? $rate->rate_date),
        ]]);
    }

    public function check(Request $request, SitePages $pages): JsonResponse
    {
        $data = $request->validate([
            'product' => ['required', 'string', 'max:160'],
            'date' => ['required', 'date_format:Y-m-d'],
            'pax' => ['required', 'integer', 'min:1', 'max:40'],
        ], ['product.*' => 'Elige un producto.', 'date.*' => 'Elige una fecha.', 'pax.*' => 'Indica entre 1 y 40 viajeros.']);

        return response()->json(['data' => $pages->check($data['product'], $data['date'], (int) $data['pax'])]);
    }

    public function guaranteed(Request $request, SitePages $pages): JsonResponse
    {
        $limit = max(1, min(50, (int) $request->query('limit', 12)));

        return response()->json(['data' => $pages->guaranteedDepartures($limit)]);
    }

    public function departures(Request $request, string $slug, SitePages $pages): JsonResponse
    {
        $from = $request->query('from');
        $to = $request->query('to');

        return response()->json(['data' => $pages->productDepartures($slug, is_string($from) ? $from : null, is_string($to) ? $to : null)]);
    }

    public function availability(Request $request, string $slug, SitePages $pages): JsonResponse
    {
        $data = $request->validate([
            'month' => ['required', 'date_format:Y-m'],
            'pax' => ['nullable', 'integer', 'min:1', 'max:40'],
        ], ['month.*' => 'El mes no es válido.', 'pax.*' => 'Indica entre 1 y 40 viajeros.']);

        return response()->json(['data' => $pages->availability($slug, $data['month'], (int) ($data['pax'] ?? 2))]);
    }

    public function reviews(Request $request, SitePages $pages): JsonResponse
    {
        $data = $request->validate([
            'product' => ['nullable', 'string', 'max:160'],
            'stars' => ['nullable', 'integer', 'min:1', 'max:5'],
        ]);

        return response()->json(['data' => $pages->publicReviews($data['product'] ?? null, isset($data['stars']) ? (int) $data['stars'] : null, 50)]);
    }

    public function calendar(Request $request, string $slug, SitePages $pages): JsonResponse
    {
        $data = $request->validate([
            'mes' => ['required', 'date_format:Y-m'],
            'viajeros' => ['nullable', 'integer', 'min:1', 'max:40'],
        ], ['mes.*' => 'El mes no es válido.', 'viajeros.*' => 'Indica entre 1 y 40 viajeros.']);

        return response()->json(['data' => $pages->calendar($slug, $data['mes'], (int) ($data['viajeros'] ?? 2))]);
    }

    public function quote(Request $request, SiteQuote $quote): JsonResponse
    {
        $data = $request->validate([
            'product' => ['required', 'string', 'max:160'],
            'date' => ['required', 'date_format:Y-m-d'],
            'adults' => ['required', 'integer', 'min:1', 'max:40'],
            'children' => ['nullable', 'integer', 'min:0', 'max:20'],
            'infants' => ['nullable', 'integer', 'min:0', 'max:10'],
            'promo' => ['nullable', 'string', 'max:40'],
        ], [
            'product.*' => 'Elige un producto.',
            'date.*' => 'Elige una fecha del calendario.',
            'adults.*' => 'Incluye al menos 1 adulto.',
            'children.*' => 'Revisa el número de niños.',
            'infants.*' => 'Revisa el número de infantes.',
        ]);

        return response()->json(['data' => $quote->quote($quote->product($data['product']), $data['date'], (int) $data['adults'], (int) ($data['children'] ?? 0), (int) ($data['infants'] ?? 0), $data['promo'] ?? null)]);
    }

    public function formOptions(SitePages $pages): JsonResponse
    {
        return response()->json(['data' => ['sedes' => $pages->sedes(), 'search' => $pages->searchOptions()]]);
    }
}
