<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Http\Controllers;

use App\Domain\Booking\Actions\ConvertQuoteToReservation;
use App\Domain\Booking\Http\Resources\ReservationResource;
use App\Domain\Booking\Support\ConversionPlan;
use App\Domain\Iam\Models\User;
use App\Domain\Quotes\Http\Requests\ConvertQuoteRequest;
use App\Domain\Quotes\Models\Quote;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

final class QuoteConversionController
{
    public function preview(Request $request, Quote $quote, ConversionPlan $plan): JsonResponse
    {
        Gate::forUser($request->user())->authorize('view', $quote);

        return response()->json(['data' => $plan->preview($quote)]);
    }

    public function convert(ConvertQuoteRequest $request, Quote $quote, ConvertQuoteToReservation $convert): JsonResponse
    {
        $actor = $request->user();
        assert($actor instanceof User);

        $reservation = $convert->handle(
            quoteId: (string) $quote->id,
            idempotencyKey: $request->idempotencyKey(),
            lockVersion: $request->lockVersion(),
            actor: $actor,
            notes: $request->validated('notes'),
        );

        return ReservationResource::make($reservation)
            ->additional(['meta' => [
                'quote_id' => $quote->id,
                'quote_code' => $quote->code,
                'quote_status' => 'convertida',
                'idempotent' => ! $reservation->wasRecentlyCreated,
            ]])
            ->response()
            ->setStatusCode($reservation->wasRecentlyCreated ? 201 : 200);
    }
}
