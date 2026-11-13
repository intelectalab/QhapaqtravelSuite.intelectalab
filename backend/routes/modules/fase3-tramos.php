<?php

declare(strict_types=1);

use App\Domain\Booking\Http\Controllers\InTripController;
use App\Domain\Catalog\Http\Controllers\TripController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:catalog.products.view')->group(function (): void {
    Route::get('catalog/products/{product}/trip', [TripController::class, 'show'])->name('tramos.trip.show');
    Route::get('catalog/hotels/{hotel}/season-rates', [TripController::class, 'seasonRates'])->name('tramos.season-rates.index');

    Route::middleware('permission:catalog.products.update')->group(function (): void {
        Route::put('catalog/products/{product}/trip/legs/{leg}/nights', [TripController::class, 'nights'])->name('tramos.legs.nights');
        Route::post('catalog/hotels/{hotel}/season-rates', [TripController::class, 'storeSeasonRate'])->name('tramos.season-rates.store');
        Route::delete('catalog/hotels/{hotel}/season-rates/{rate}', [TripController::class, 'destroySeasonRate'])->name('tramos.season-rates.destroy');
        Route::post('catalog/products/{product}/trip/tours', [TripController::class, 'storeTour'])->name('tramos.tours.store');
        Route::patch('catalog/products/{product}/trip/tours/{tour}', [TripController::class, 'updateTour'])->name('tramos.tours.update');
        Route::post('catalog/products/{product}/trip/transport', [TripController::class, 'storeTransport'])->name('tramos.transport.store');
        Route::patch('catalog/products/{product}/trip/transport/{option}', [TripController::class, 'updateTransport'])->name('tramos.transport.update');
    });
});

Route::middleware('permission:reservations.view')->group(function (): void {
    Route::get('reservations/{code}/trip', [InTripController::class, 'trip'])->name('tramos.reservations.trip');
    Route::get('reservations/{code}/in-trip-offers', [InTripController::class, 'index'])->name('tramos.offers.index');

    Route::middleware('permission:reservations.modify')->group(function (): void {
        Route::post('reservations/{code}/in-trip-offers', [InTripController::class, 'store'])->name('tramos.offers.store');
        Route::post('reservations/{code}/in-trip-offers/{offer}/cancel', [InTripController::class, 'cancel'])->name('tramos.offers.cancel');
    });

    Route::get('portal/client/reservations/{code}/in-trip', [InTripController::class, 'portal'])->name('portal.tramos.in-trip.show');
    Route::post('portal/client/reservations/{code}/in-trip', [InTripController::class, 'portalStore'])->middleware('throttle:10,1')->name('portal.tramos.in-trip.store');
});
