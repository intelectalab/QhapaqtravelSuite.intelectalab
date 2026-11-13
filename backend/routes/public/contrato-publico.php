<?php

declare(strict_types=1);

use App\Domain\Site\Http\Controllers\SiteCartController;
use App\Domain\Site\Http\Controllers\SiteFormController;
use App\Domain\Site\Http\Middleware\ScopeSiteTenant;
use Illuminate\Support\Facades\Route;

Route::middleware(['public.site', ScopeSiteTenant::class])->name('site.contract.')->group(function (): void {
    Route::patch('carts/current/items/{line}', [SiteCartController::class, 'update'])->whereNumber('line')->middleware('throttle:60,1')->name('cart.items.update');
    Route::put('carts/current/preferences', [SiteCartController::class, 'preferences'])->middleware('throttle:60,1')->name('cart.preferences');
    Route::post('claims', [SiteFormController::class, 'claim'])->middleware(['throttle:5,1', 'captcha'])->name('claims');
    Route::post('bookings', [SiteCartController::class, 'bookings'])->middleware(['throttle:public-bookings', 'captcha'])->name('bookings');
});
