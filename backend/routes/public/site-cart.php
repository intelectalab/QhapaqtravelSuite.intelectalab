<?php

declare(strict_types=1);

use App\Domain\Site\Http\Controllers\SiteCartController;
use App\Domain\Site\Http\Middleware\ScopeSiteTenant;
use Illuminate\Support\Facades\Route;

Route::middleware(['public.site', ScopeSiteTenant::class])->name('site.cart.')->group(function (): void {
    Route::get('carts/current', [SiteCartController::class, 'show'])->name('show');
    Route::post('carts/current/items', [SiteCartController::class, 'add'])->name('items.store');
    Route::put('carts/current/promo', [SiteCartController::class, 'applyPromo'])->middleware('throttle:10,1')->name('promo.apply');
    Route::delete('carts/current/promo', [SiteCartController::class, 'clearPromo'])->name('promo.clear');
    Route::delete('carts/current/items/{line}', [SiteCartController::class, 'remove'])->whereNumber('line')->name('items.destroy');
    Route::post('carts/current/items/{line}/hold', [SiteCartController::class, 'hold'])->whereNumber('line')->name('items.hold');
    Route::post('checkout/orders', [SiteCartController::class, 'checkout'])->middleware(['throttle:10,1', 'captcha'])->name('checkout');
    Route::post('checkout/validate', [SiteCartController::class, 'validateCheckout'])->middleware('throttle:60,1')->name('checkout.validate');
    Route::get('orders/{code}', [SiteCartController::class, 'order'])->name('orders.show');
    Route::post('orders/{code}/payments', [SiteCartController::class, 'pay'])->middleware('throttle:10,1')->name('orders.pay');
});
