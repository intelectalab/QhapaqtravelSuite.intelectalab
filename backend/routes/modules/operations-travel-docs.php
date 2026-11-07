<?php

declare(strict_types=1);

use App\Domain\Operations\Http\Controllers\TravelDocController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:operations.travel_docs|reservations.create')->group(function (): void {
    Route::get('ops/travel-docs', [TravelDocController::class, 'index'])->name('ops.travel-docs.index');
    Route::get('reservations/{code}/travel-docs', [TravelDocController::class, 'show'])->name('ops.travel-docs.show');

    Route::middleware('permission:operations.travel_docs')->group(function (): void {
        Route::post('reservations/{code}/travel-docs/{passenger}/{type}/validate', [TravelDocController::class, 'validateItem'])->name('ops.travel-docs.validate');
        Route::post('reservations/{code}/travel-docs/{passenger}/{type}/observe', [TravelDocController::class, 'observe'])->name('ops.travel-docs.observe');
    });
});
