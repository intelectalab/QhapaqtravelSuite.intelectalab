<?php

declare(strict_types=1);

namespace App\Domain\Site\Http\Controllers;

use App\Domain\Site\Support\SiteCatalog;
use App\Domain\Site\Support\SitePages;
use App\Domain\Site\Support\SiteProfile;
use App\Domain\Site\Support\SiteQuote;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

    public function calendar(Request $request, string $slug, SitePages $pages): JsonResponse
    {
        $data = $request->validate([
            'mes' => ['required', 'date_format:Y-m'],
            'viajeros' => ['nullable', 'integer', 'min:1', 'max:40'],
        ], ['mes.*' => 'El mes no es válido.', 'viajeros.*' => 'Indica entre 1 y 40 viajeros.']);

        return response()->json(['data' => $pages->calendar($slug, $data['mes'], (int) ($data['viajeros'] ?? 2))]);
    }

    public function quote(Request $request, string $slug, SiteQuote $quote): JsonResponse
    {
        $data = $request->validate([
            'date' => ['required', 'date_format:Y-m-d'],
            'adults' => ['required', 'integer', 'min:1', 'max:40'],
            'children' => ['nullable', 'integer', 'min:0', 'max:20'],
            'infants' => ['nullable', 'integer', 'min:0', 'max:10'],
            'promo' => ['nullable', 'string', 'max:40'],
        ], [
            'date.*' => 'Elige una fecha del calendario.',
            'adults.*' => 'Incluye al menos 1 adulto.',
            'children.*' => 'Revisa el número de niños.',
            'infants.*' => 'Revisa el número de infantes.',
        ]);

        return response()->json(['data' => $quote->quote($quote->product($slug), $data['date'], (int) $data['adults'], (int) ($data['children'] ?? 0), (int) ($data['infants'] ?? 0), $data['promo'] ?? null)]);
    }

    public function formOptions(SitePages $pages): JsonResponse
    {
        return response()->json(['data' => ['sedes' => $pages->sedes(), 'search' => $pages->searchOptions()]]);
    }
}
