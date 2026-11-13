<?php

declare(strict_types=1);

use App\Domain\Catalog\Http\Controllers\AllotmentController;
use App\Domain\Catalog\Http\Controllers\DestinationController;
use App\Domain\Catalog\Http\Controllers\PricingController;
use App\Domain\Catalog\Http\Controllers\ScheduleController;
use App\Domain\Operations\Http\Controllers\TravelDocController;
use App\Domain\Quotes\Http\Controllers\PublicQuoteDecisionController;
use App\Domain\Quotes\Http\Controllers\QuotePickerController;
use Illuminate\Support\Facades\Route;

Route::name('contract.')->group(function (): void {
    Route::middleware('permission:catalog.products.view')->group(function (): void {
        Route::get('catalog/departures/{ref}', [ScheduleController::class, 'departure'])->name('catalog.departures.show');
        Route::get('catalog/destinations/{ref}', [DestinationController::class, 'show'])->name('catalog.destinations.show');
        Route::get('catalog/holds', [ScheduleController::class, 'holds'])->name('catalog.holds.index');
        Route::get('catalog/seasons', [PricingController::class, 'seasons'])->name('catalog.seasons.index');
        Route::get('catalog/seasons/resolve', [PricingController::class, 'resolveSeason'])->name('catalog.seasons.resolve');
        Route::get('catalog/products/{product}/departures', [ScheduleController::class, 'productDepartures'])->name('catalog.products.departures.index');
        Route::get('catalog/products/{product}/rates', [PricingController::class, 'productRates'])->name('catalog.products.rates.index');
        Route::get('catalog/products/{product}/seasons', [PricingController::class, 'productSeasons'])->name('catalog.products.seasons.index');
        Route::get('catalog/products/{product}/availability', [ScheduleController::class, 'availability'])->name('catalog.products.availability.show');
        Route::get('catalog/products/{product}/availability-ranges', [ScheduleController::class, 'ranges'])->name('catalog.products.availability-ranges.index');
        Route::get('catalog/products/{product}/providers', [PricingController::class, 'providers'])->name('catalog.products.providers.index');
        Route::post('catalog/products/{product}/price-quote', [PricingController::class, 'priceQuote'])->middleware('throttle:120,1')->name('catalog.products.price-quote');

        Route::middleware('permission:catalog.products.manage_availability')->group(function (): void {
            Route::post('catalog/products/{product}/departures', [ScheduleController::class, 'storeDeparture'])->name('catalog.products.departures.store');
            Route::patch('catalog/products/{product}/departures/{departure}', [ScheduleController::class, 'updateDeparture'])->name('catalog.products.departures.update');
            Route::post('catalog/products/{product}/availability-ranges/close-dates', [ScheduleController::class, 'closeDates'])->name('catalog.products.availability-ranges.close-dates');
        });
    });

    Route::delete('catalog/seasons/{ref}', [PricingController::class, 'destroySeason'])->middleware('permission:catalog.products.manage_rates')->name('catalog.seasons.destroy');
    Route::get('catalog/products/{product}/profitability', [PricingController::class, 'profitability'])->middleware('permission:catalog.products.view_profitability')->name('catalog.products.profitability');

    Route::middleware('permission:quotes.create')->group(function (): void {
        Route::get('catalog/products/quoteable', [QuotePickerController::class, 'quoteable'])->name('catalog.products.quoteable');
        Route::get('catalog/products/{product}/rate-suggestion', [QuotePickerController::class, 'rateSuggestion'])->name('catalog.products.rate-suggestion');
    });

    Route::middleware('permission:catalog.allotments.manage|catalog.products.view_profitability')->group(function (): void {
        Route::get('catalog/allotments/{code}/charges', [AllotmentController::class, 'charges'])->name('catalog.allotments.charges.index');
        Route::get('catalog/allotments/{code}/requests', [AllotmentController::class, 'requests'])->name('catalog.allotments.requests.index');
        Route::get('catalog/allotments/{code}/days/{date}', [AllotmentController::class, 'day'])->where('date', '\d{4}-\d{2}-\d{2}')->name('catalog.allotments.days.show');
    });

    Route::get('reservations/{code}/travel-docs/gate', [TravelDocController::class, 'gate'])->middleware('permission:operations.view')->name('reservations.travel-docs.gate');
});

Route::prefix('public')->middleware(['permission:quotes.view', 'throttle:10,1'])->name('portal.quotes.token.')->group(function (): void {
    Route::post('quotes/{token}/approve', [PublicQuoteDecisionController::class, 'approve'])->name('approve');
    Route::post('quotes/{token}/reject', [PublicQuoteDecisionController::class, 'reject'])->name('reject');
});
