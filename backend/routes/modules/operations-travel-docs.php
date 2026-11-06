<?php

declare(strict_types=1);

use App\Domain\Operations\Http\Controllers\TravelDocController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:operations.travel_docs|reservations.create')->prefix('ops')->group(function (): void {
    Route::get('travel-docs', [TravelDocController::class, 'index'])->name('ops.travel-docs.index');
    Route::get('travel-docs/{code}', [TravelDocController::class, 'show'])->name('ops.travel-docs.show');

    Route::middleware('permission:operations.travel_docs')->group(function (): void {
        Route::post('travel-docs/items/{item}/validate', [TravelDocController::class, 'validateItem'])->name('ops.travel-docs.validate');
        Route::post('travel-docs/items/{item}/observe', [TravelDocController::class, 'observe'])->name('ops.travel-docs.observe');
    });
});
