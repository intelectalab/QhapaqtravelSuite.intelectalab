<?php

declare(strict_types=1);

use App\Domain\Site\Http\Controllers\SiteController;
use App\Domain\Site\Http\Middleware\ScopeSiteTenant;
use Illuminate\Support\Facades\Route;

Route::prefix('sites/{site}')->middleware(['public.site', ScopeSiteTenant::class])->name('sites.')->group(function (): void {
    Route::get('/', [SiteController::class, 'profile'])->name('profile');
    Route::get('home', [SiteController::class, 'home'])->name('home');
    Route::get('form-options', [SiteController::class, 'formOptions'])->name('form-options');
    Route::get('destinations', [SiteController::class, 'destinations'])->name('destinations.index');
    Route::get('destinations/{slug}', [SiteController::class, 'destination'])->name('destinations.show');
    Route::get('products', [SiteController::class, 'products'])->name('products.index');
    Route::get('products/{slug}', [SiteController::class, 'product'])->name('products.show');
    Route::get('products/{slug}/calendar', [SiteController::class, 'calendar'])->name('products.calendar');
    Route::post('products/{slug}/quote', [SiteController::class, 'quote'])->name('products.quote');
});
