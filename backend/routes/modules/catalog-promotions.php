<?php

declare(strict_types=1);

use App\Domain\Catalog\Http\Controllers\PromotionController;
use Illuminate\Support\Facades\Route;

Route::get('channels/ecommerce/promotions', [PromotionController::class, 'all'])->middleware('permission:channels.ecommerce.manage|catalog.products.update')->name('channels.ecommerce.promotions');
Route::get('catalog/products/{code}/promotions', [PromotionController::class, 'index'])->middleware('permission:catalog.products.view')->name('catalog.products.promotions.index');

Route::middleware('permission:channels.ecommerce.manage|catalog.products.update')->group(function (): void {
    Route::post('catalog/products/{code}/promotions', [PromotionController::class, 'store'])->name('catalog.products.promotions.store');
    Route::patch('catalog/products/{code}/promotions/{ref}', [PromotionController::class, 'update'])->name('catalog.products.promotions.update');
    Route::delete('catalog/products/{code}/promotions/{ref}', [PromotionController::class, 'destroy'])->name('catalog.products.promotions.destroy');
    Route::post('catalog/products/{code}/promotions/{ref}/pause', [PromotionController::class, 'pause'])->name('catalog.products.promotions.pause');
    Route::post('catalog/products/{code}/promotions/{ref}/activate', [PromotionController::class, 'activate'])->name('catalog.products.promotions.activate');
    Route::post('catalog/promotions/{ref}/activate', [PromotionController::class, 'activateByRef'])->name('catalog.promotions.activate');
    Route::post('catalog/promotions/{ref}/deactivate', [PromotionController::class, 'deactivateByRef'])->name('catalog.promotions.deactivate');
});
