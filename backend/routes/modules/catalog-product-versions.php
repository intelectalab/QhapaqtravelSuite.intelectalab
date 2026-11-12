<?php

declare(strict_types=1);

use App\Domain\Catalog\Http\Controllers\ProductVersionController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:catalog.products.view')->group(function (): void {
    Route::get('catalog/products/{code}/versions', [ProductVersionController::class, 'index'])->name('catalog.products.versions.index');
    Route::get('catalog/products/{code}/versions/compare', [ProductVersionController::class, 'compare'])->name('catalog.products.versions.compare');
    Route::get('catalog/products/{code}/versions/{version}', [ProductVersionController::class, 'show'])->name('catalog.products.versions.show');
    Route::get('catalog/products/{code}/rates/resolve', [ProductVersionController::class, 'resolve'])->name('catalog.products.rates.resolve');
    Route::post('catalog/products/{code}/versions', [ProductVersionController::class, 'store'])->middleware('permission:catalog.products.update')->name('catalog.products.versions.store');
    Route::post('catalog/products/{code}/duplicate', [ProductVersionController::class, 'duplicate'])->middleware('permission:catalog.products.create')->name('catalog.products.duplicate');
});
