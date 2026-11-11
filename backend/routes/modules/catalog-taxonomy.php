<?php

declare(strict_types=1);

use App\Domain\Catalog\Http\Controllers\TaxonomyController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:catalog.products.view')->group(function (): void {
    Route::get('catalog/product-types', [TaxonomyController::class, 'types'])->name('catalog.product-types.index');
    Route::get('catalog/categories', [TaxonomyController::class, 'categories'])->name('catalog.categories.index');

    Route::middleware('permission:catalog.products.update')->group(function (): void {
        Route::post('catalog/product-types', [TaxonomyController::class, 'storeType'])->name('catalog.product-types.store');
        Route::patch('catalog/product-types/{id}', [TaxonomyController::class, 'updateType'])->name('catalog.product-types.update');
        Route::delete('catalog/product-types/{id}', [TaxonomyController::class, 'destroyType'])->name('catalog.product-types.destroy');
        Route::post('catalog/categories', [TaxonomyController::class, 'storeCategory'])->name('catalog.categories.store');
        Route::patch('catalog/categories/{ref}', [TaxonomyController::class, 'updateCategory'])->name('catalog.categories.update');
        Route::delete('catalog/categories/{ref}', [TaxonomyController::class, 'destroyCategory'])->name('catalog.categories.destroy');
        Route::post('catalog/categories/{ref}/subcategories', [TaxonomyController::class, 'storeSubcategory'])->name('catalog.categories.subcategories.store');
        Route::patch('catalog/categories/{ref}/subcategories/{subId}', [TaxonomyController::class, 'updateSubcategory'])->name('catalog.categories.subcategories.update');
        Route::delete('catalog/categories/{ref}/subcategories/{subId}', [TaxonomyController::class, 'destroySubcategory'])->name('catalog.categories.subcategories.destroy');
    });
});
