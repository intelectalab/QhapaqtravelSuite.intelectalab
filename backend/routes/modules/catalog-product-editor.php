<?php

declare(strict_types=1);

use App\Domain\Catalog\Http\Controllers\ProductEditorController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:catalog.products.view')->group(function (): void {
    Route::post('catalog/products/preview', [ProductEditorController::class, 'preview'])->middleware('permission:catalog.products.create|catalog.products.update')->name('catalog.products.preview');
    Route::get('catalog/products/{code}/editor', [ProductEditorController::class, 'show'])->name('catalog.products.editor');
    Route::get('catalog/products/{code}/overview', [ProductEditorController::class, 'overview'])->name('catalog.products.overview');

    Route::middleware('permission:catalog.products.update')->group(function (): void {
        Route::put('catalog/products/{code}/main-provider', [ProductEditorController::class, 'mainProvider'])->name('catalog.products.main-provider');
        Route::put('catalog/products/{code}/components', [ProductEditorController::class, 'components'])->name('catalog.products.components.sync');
        Route::post('catalog/products/{code}/components', [ProductEditorController::class, 'storeComponent'])->name('catalog.products.components.store');
        Route::patch('catalog/products/{code}/components/{component}', [ProductEditorController::class, 'updateComponent'])->name('catalog.products.components.update');
        Route::delete('catalog/products/{code}/components/{component}', [ProductEditorController::class, 'destroyComponent'])->name('catalog.products.components.destroy');
        Route::put('catalog/products/{code}/itinerary', [ProductEditorController::class, 'itinerary'])->name('catalog.products.itinerary.sync');
        Route::post('catalog/products/{code}/itineraries/{itinerary}/days', [ProductEditorController::class, 'storeDay'])->name('catalog.products.itinerary.days.store');
        Route::patch('catalog/products/{code}/itineraries/{itinerary}/days/{day}', [ProductEditorController::class, 'updateDay'])->name('catalog.products.itinerary.days.update');
        Route::delete('catalog/products/{code}/itineraries/{itinerary}/days/{day}', [ProductEditorController::class, 'destroyDay'])->name('catalog.products.itinerary.days.destroy');
        Route::post('catalog/products/{code}/itineraries/{itinerary}/days/{day}/items', [ProductEditorController::class, 'storeItem'])->name('catalog.products.itinerary.items.store');
        Route::patch('catalog/products/{code}/itineraries/{itinerary}/days/{day}/items/{item}', [ProductEditorController::class, 'updateItem'])->name('catalog.products.itinerary.items.update');
        Route::delete('catalog/products/{code}/itineraries/{itinerary}/days/{day}/items/{item}', [ProductEditorController::class, 'destroyItem'])->name('catalog.products.itinerary.items.destroy');
        Route::put('catalog/products/{code}/seasons', [ProductEditorController::class, 'seasons'])->name('catalog.products.seasons.sync');
        Route::put('catalog/products/{code}/availability', [ProductEditorController::class, 'availability'])->name('catalog.products.availability');
        Route::put('catalog/products/{code}/content', [ProductEditorController::class, 'content'])->name('catalog.products.content');
        Route::put('catalog/products/{code}/policies', [ProductEditorController::class, 'policies'])->name('catalog.products.policies');
        Route::put('catalog/products/{code}/channels', [ProductEditorController::class, 'channels'])->name('catalog.products.channels.sync');
    });

    Route::middleware('permission:catalog.products.manage_rates')->group(function (): void {
        Route::post('catalog/products/{code}/seasons', [ProductEditorController::class, 'storeSeason'])->name('catalog.products.seasons.store');
        Route::delete('catalog/products/{code}/seasons/{season}', [ProductEditorController::class, 'destroySeason'])->name('catalog.products.seasons.destroy');
    });

    Route::put('catalog/products/{code}/channels/{channel}', [ProductEditorController::class, 'publishChannel'])->middleware('permission:catalog.products.publish')->name('catalog.products.channels.publish');
});
