<?php

declare(strict_types=1);

use App\Domain\Catalog\Http\Controllers\B2bRateController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:channels.b2b.manage')->group(function (): void {
    Route::get('channels/b2b/product-rates', [B2bRateController::class, 'overview'])->name('channels.b2b.product-rates');
    Route::get('channels/b2b/price-lists', [B2bRateController::class, 'priceLists'])->name('channels.b2b.price-lists');
});

Route::get('catalog/products/{code}/b2b-rates', [B2bRateController::class, 'index'])->middleware('permission:channels.b2b.manage|catalog.products.update')->name('catalog.products.b2b-rates.index');

Route::middleware('permission:channels.b2b.manage|catalog.products.update')->group(function (): void {
    Route::post('catalog/products/{code}/b2b-rates', [B2bRateController::class, 'store'])->name('catalog.products.b2b-rates.store');
    Route::put('catalog/products/{code}/b2b-rates/{agency}', [B2bRateController::class, 'replace'])->name('catalog.products.b2b-rates.replace');
    Route::patch('catalog/products/{code}/b2b-rates/{agency}', [B2bRateController::class, 'update'])->name('catalog.products.b2b-rates.update');
    Route::delete('catalog/products/{code}/b2b-rates/{agency}', [B2bRateController::class, 'destroy'])->name('catalog.products.b2b-rates.destroy');
});
