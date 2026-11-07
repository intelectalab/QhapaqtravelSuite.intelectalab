<?php

declare(strict_types=1);

use App\Domain\Catalog\Http\Controllers\AvailabilityController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:catalog.allotments.manage|catalog.products.view_profitability')->group(function (): void {
    Route::get('catalog/availability', [AvailabilityController::class, 'index'])->name('catalog.availability.index');

    Route::middleware('permission:catalog.allotments.manage')->group(function (): void {
        Route::post('catalog/products/{product}/availability-ranges', [AvailabilityController::class, 'storeRange'])->name('catalog.availability.ranges.store');
        Route::patch('catalog/products/{product}/availability-ranges/{code}', [AvailabilityController::class, 'updateRange'])->name('catalog.availability.ranges.update');
        Route::delete('catalog/products/{product}/availability-ranges/{code}', [AvailabilityController::class, 'destroyRange'])->name('catalog.availability.ranges.destroy');
    });

    Route::middleware('permission:catalog.products.manage_availability')->group(function (): void {
        Route::post('catalog/holds', [AvailabilityController::class, 'storeHold'])->name('catalog.holds.store');
        Route::post('catalog/holds/expire', [AvailabilityController::class, 'expireHolds'])->name('catalog.holds.expire');
        Route::post('catalog/holds/{ref}/confirm', [AvailabilityController::class, 'confirmHold'])->name('catalog.holds.confirm');
        Route::post('catalog/holds/{ref}/release', [AvailabilityController::class, 'releaseHold'])->name('catalog.holds.release');
        Route::post('catalog/holds/{ref}/consume', [AvailabilityController::class, 'consumeHold'])->name('catalog.holds.consume');
    });
});
