<?php

declare(strict_types=1);

use App\Domain\Catalog\Http\Controllers\DepartureController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:catalog.products.view')->group(function (): void {
    Route::get('catalog/departures', [DepartureController::class, 'index'])->name('catalog.departures.index');

    Route::middleware('permission:catalog.products.manage_availability')->group(function (): void {
        Route::post('catalog/departures', [DepartureController::class, 'store'])->name('catalog.departures.store');
        Route::patch('catalog/departures/{ref}', [DepartureController::class, 'update'])->name('catalog.departures.update');
        Route::post('catalog/departures/{ref}/close', [DepartureController::class, 'close'])->name('catalog.departures.close');
        Route::post('catalog/departures/{ref}/cancel', [DepartureController::class, 'cancel'])->name('catalog.departures.cancel');
        Route::post('catalog/departures/{ref}/confirm-seats', [DepartureController::class, 'confirmSeats'])->name('catalog.departures.confirm-seats');
    });
});
