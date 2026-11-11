<?php

declare(strict_types=1);

use App\Domain\Catalog\Http\Controllers\PriceRuleController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:catalog.products.manage_rates|catalog.products.view_profitability')->group(function (): void {
    Route::get('catalog/price-rules', [PriceRuleController::class, 'index'])->name('catalog.price-rules.index');
    Route::post('catalog/pricing/simulate', [PriceRuleController::class, 'simulate'])->name('catalog.pricing.simulate');

    Route::middleware('permission:catalog.products.manage_rates')->group(function (): void {
        Route::post('catalog/price-rules', [PriceRuleController::class, 'store'])->name('catalog.price-rules.store');
        Route::patch('catalog/price-rules/{ref}', [PriceRuleController::class, 'update'])->name('catalog.price-rules.update');
        Route::delete('catalog/price-rules/{ref}', [PriceRuleController::class, 'destroy'])->name('catalog.price-rules.destroy');
        Route::post('catalog/price-rules/{ref}/activate', [PriceRuleController::class, 'activate'])->name('catalog.price-rules.activate');
        Route::post('catalog/price-rules/{ref}/deactivate', [PriceRuleController::class, 'deactivate'])->name('catalog.price-rules.deactivate');
    });
});
