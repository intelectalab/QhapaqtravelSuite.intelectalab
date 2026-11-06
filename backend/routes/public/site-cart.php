<?php

declare(strict_types=1);

use App\Domain\Site\Http\Controllers\SiteCartController;
use App\Domain\Site\Http\Middleware\ScopeSiteTenant;
use Illuminate\Support\Facades\Route;

Route::prefix('sites/{site}')->middleware(['public.site', ScopeSiteTenant::class])->name('sites.cart.')->group(function (): void {
    Route::get('cart', [SiteCartController::class, 'show'])->name('show');
    Route::post('cart/items', [SiteCartController::class, 'add'])->name('items.store');
    Route::delete('cart/items/{line}', [SiteCartController::class, 'remove'])->whereNumber('line')->name('items.destroy');
    Route::post('cart/items/{line}/hold', [SiteCartController::class, 'hold'])->whereNumber('line')->name('items.hold');
    Route::post('checkout', [SiteCartController::class, 'checkout'])->middleware('throttle:10,1')->name('checkout');
    Route::get('orders/{code}', [SiteCartController::class, 'order'])->name('orders.show');
    Route::post('orders/{code}/pay', [SiteCartController::class, 'pay'])->middleware('throttle:10,1')->name('orders.pay');
});
