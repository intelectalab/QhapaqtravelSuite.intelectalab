<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Http\Controllers;

use App\Domain\Bookings\Actions\ConvertQuoteToReservation;
use App\Domain\Bookings\Http\Resources\ReservationResource;
use App\Domain\Quotes\Http\Requests\ConvertQuoteRequest;
use App\Domain\Quotes\Models\Quote;
use Illuminate\Http\JsonResponse;

/**
 * Controlador delgado (02-ARQUITECTURA §3): FormRequest valida y autoriza (Policy) → Action hace el trabajo.
 *
 * Respuesta (spec 04 §4.3 pasos 4 y 19; plantilla Pest ConvertQuoteIdempotencyTest):
 *   201 { data: Reservation, meta: { quote_id, quote_status: "convertida", idempotent: false } }   nueva reserva
 *   200 { data: Reservation, meta: { …, idempotent: true } }                                      ya estaba convertida
 *
 * DIFERENCIA CON EL CONTRATO (Por definir): openapi.yaml declara para `quotesConvert` solo `200` con
 * `data: QuoteQuote` (esquema genérico del generador). La spec 04 §4.3 y las pruebas Pest esperan 201 con la
 * reserva. Se sigue la spec + pruebas y se propone actualizar §6 de la spec 03/04 para que el contrato lo refleje.
 */
final class QuoteConversionController
{
    public function __invoke(ConvertQuoteRequest $request, Quote $quote, ConvertQuoteToReservation $convert): JsonResponse
    {
        $reservation = $convert->handle(
            quoteId: $quote->id,
            idempotencyKey: $request->idempotencyKey(),
            lockVersion: $request->lockVersion(),
            actor: $request->user(),
            notes: $request->validated('notes'),
        );

        return ReservationResource::make($reservation)
            ->additional(['meta' => [
                'quote_id' => $quote->id,
                'quote_status' => 'convertida',
                'idempotent' => ! $reservation->wasRecentlyCreated,
            ]])
            ->response()
            ->setStatusCode($reservation->wasRecentlyCreated ? 201 : 200);
    }
}
