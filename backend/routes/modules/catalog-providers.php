<?php

declare(strict_types=1);

use App\Domain\Catalog\Http\Controllers\ProviderController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:catalog.providers.manage|finance.payables|catalog.products.update')->group(function (): void {
    Route::get('catalog/providers', [ProviderController::class, 'index'])->name('catalog.providers.index');

    Route::middleware('permission:catalog.providers.manage')->group(function (): void {
        Route::post('catalog/providers', [ProviderController::class, 'store'])->name('catalog.providers.store');
        Route::patch('catalog/providers/{ref}', [ProviderController::class, 'update'])->name('catalog.providers.update');
        Route::post('catalog/providers/{ref}/activate', [ProviderController::class, 'activate'])->name('catalog.providers.activate');
        Route::post('catalog/providers/{ref}/deactivate', [ProviderController::class, 'deactivate'])->name('catalog.providers.deactivate');
        Route::post('catalog/providers/{ref}/contacts', [ProviderController::class, 'storeContact'])->name('catalog.providers.contacts.store');
        Route::delete('catalog/providers/{ref}/contacts/{contact}', [ProviderController::class, 'destroyContact'])->name('catalog.providers.contacts.destroy');
    });
});
