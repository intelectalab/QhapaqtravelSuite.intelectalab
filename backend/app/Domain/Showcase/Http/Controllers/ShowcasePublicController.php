<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Http\Controllers;

use App\Domain\Showcase\Actions\ManageShowcaseAgencies;
use App\Domain\Showcase\Actions\ShowcaseBookings;
use App\Domain\Showcase\Support\FunnelRecorder;
use App\Domain\Showcase\Support\ShowcaseDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ShowcasePublicController
{
    public function listings(Request $request, ShowcaseDirectory $directory): JsonResponse
    {
        $filters = $request->validate([
            'city' => ['nullable', 'string', 'max:40'],
            'zone' => ['nullable', 'string', 'max:80'],
            'theme' => ['nullable', 'string', 'max:40'],
            'lang' => ['nullable', 'string', 'size:2'],
            'model' => ['nullable', 'in:propina,pago'],
        ]);

        return response()->json(['data' => $directory->publicListings($filters)]);
    }

    public function overview(ShowcaseDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->publicOverview()]);
    }

    public function listing(Request $request, string $slug, ShowcaseDirectory $directory, FunnelRecorder $funnel): JsonResponse
    {
        $listing = $directory->publicListing($slug);
        $funnel->record('visita', null, null, $listing['id'], FunnelRecorder::utm($request->query()));

        return response()->json(['data' => $listing]);
    }

    public function book(Request $request, string $slug, ShowcaseBookings $bookings): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:160'],
            'email' => ['required', 'email:rfc', 'max:160'],
            'date' => ['required', 'date_format:Y-m-d'],
            'time' => ['required', 'regex:/^[0-2][0-9]:[0-5][0-9]$/'],
            'pax' => ['required', 'integer', 'between:1,30'],
            'language' => ['required', 'string', 'size:2'],
            'marketing_consent' => ['nullable', 'boolean'],
            'utm_source' => ['nullable', 'string', 'max:80'],
            'utm_medium' => ['nullable', 'string', 'max:80'],
            'utm_campaign' => ['nullable', 'string', 'max:120'],
        ], [
            'name.required' => 'Escriba su nombre.',
            'email.required' => 'Escriba su correo.',
            'email.email' => 'Revise el correo: no parece válido.',
            'date.*' => 'Elija la fecha de la salida.',
            'time.*' => 'Elija el horario de salida.',
            'pax.*' => 'Indique entre 1 y 30 personas.',
            'language.*' => 'Elija el idioma del tour.',
        ]);

        return response()->json(['data' => $bookings->book($slug, $data)]);
    }

    public function cancel(string $token, ShowcaseBookings $bookings): JsonResponse
    {
        return response()->json(['data' => $bookings->cancel($token)]);
    }

    public function posts(ShowcaseDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->posts(true)['items']]);
    }

    public function post(string $slug, ShowcaseDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->publicPost($slug)]);
    }

    public function register(Request $request, ManageShowcaseAgencies $agencies): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:160'],
            'city' => ['required', 'string', 'max:40'],
            'email' => ['required', 'email:rfc', 'max:160'],
            'phone' => ['nullable', 'string', 'max:30'],
            'ruc' => ['nullable', 'regex:/^(10|20)\d{9}$/'],
            'license_ref' => ['nullable', 'string', 'max:60'],
            'wants_pass' => ['nullable', 'boolean'],
            'marketing_opt_in' => ['nullable', 'boolean'],
            'utm_source' => ['nullable', 'string', 'max:80'],
            'utm_medium' => ['nullable', 'string', 'max:80'],
            'utm_campaign' => ['nullable', 'string', 'max:120'],
        ], [
            'name.*' => 'Escriba el nombre comercial de la agencia.',
            'city.*' => 'Elija la ciudad donde opera.',
            'email.*' => 'Escriba un correo válido.',
            'ruc.regex' => 'El RUC tiene 11 dígitos y empieza con 10 o 20.',
        ]);

        return response()->json(['data' => $agencies->register($data)], 201);
    }
}
