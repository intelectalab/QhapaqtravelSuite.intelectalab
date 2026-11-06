<?php

declare(strict_types=1);

use App\Domain\Catalog\Http\Controllers\DestinationController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:catalog.products.view')->group(function (): void {
    Route::get('catalog/destinations', [DestinationController::class, 'index'])->name('catalog.destinations.index');

    Route::middleware('permission:catalog.products.update')->group(function (): void {
        Route::post('catalog/destinations', [DestinationController::class, 'store'])->name('catalog.destinations.store');
        Route::patch('catalog/destinations/{ref}', [DestinationController::class, 'update'])->name('catalog.destinations.update');
        Route::delete('catalog/destinations/{ref}', [DestinationController::class, 'destroy'])->name('catalog.destinations.destroy');
    });
});
