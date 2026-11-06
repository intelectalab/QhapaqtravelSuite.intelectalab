<?php

declare(strict_types=1);

use App\Domain\Catalog\Http\Controllers\ServiceController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:catalog.products.view')->group(function (): void {
    Route::get('catalog/services', [ServiceController::class, 'index'])->name('catalog.services.index');

    Route::middleware('permission:catalog.providers.manage')->group(function (): void {
        Route::post('catalog/services', [ServiceController::class, 'store'])->name('catalog.services.store');
        Route::patch('catalog/services/{ref}', [ServiceController::class, 'update'])->name('catalog.services.update');
        Route::post('catalog/services/{ref}/activate', [ServiceController::class, 'activate'])->name('catalog.services.activate');
        Route::post('catalog/services/{ref}/deactivate', [ServiceController::class, 'deactivate'])->name('catalog.services.deactivate');
    });
});
