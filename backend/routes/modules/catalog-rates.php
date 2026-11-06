<?php

declare(strict_types=1);

use App\Domain\Catalog\Http\Controllers\RateController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:catalog.products.view')->group(function (): void {
    Route::get('catalog/rates', [RateController::class, 'index'])->name('catalog.rates.index');

    Route::middleware('permission:catalog.products.manage_rates')->group(function (): void {
        Route::post('catalog/rates', [RateController::class, 'store'])->name('catalog.rates.store');
        Route::patch('catalog/rates/{ref}', [RateController::class, 'update'])->name('catalog.rates.update');
        Route::post('catalog/rates/{ref}/activate', [RateController::class, 'activate'])->name('catalog.rates.activate');
        Route::post('catalog/rates/{ref}/deactivate', [RateController::class, 'deactivate'])->name('catalog.rates.deactivate');
        Route::post('catalog/seasons', [RateController::class, 'storeSeason'])->name('catalog.seasons.store');
        Route::patch('catalog/seasons/{ref}', [RateController::class, 'updateSeason'])->name('catalog.seasons.update');
        Route::post('catalog/seasons/{ref}/activate', [RateController::class, 'activateSeason'])->name('catalog.seasons.activate');
        Route::post('catalog/seasons/{ref}/deactivate', [RateController::class, 'deactivateSeason'])->name('catalog.seasons.deactivate');
    });
});
