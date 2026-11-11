<?php

declare(strict_types=1);

use App\Domain\Site\Http\Controllers\SiteCartController;
use App\Domain\Site\Http\Controllers\SiteController;
use App\Domain\Site\Http\Middleware\ScopeSiteTenant;
use Illuminate\Support\Facades\Route;

Route::middleware(['public.site', ScopeSiteTenant::class])->name('site.shop.')->group(function (): void {
    Route::post('availability', [SiteController::class, 'check'])->middleware('throttle:60,1')->name('availability');
    Route::get('shop/products', [SiteController::class, 'products'])->name('products.index');
    Route::get('shop/products/{slug}', [SiteController::class, 'product'])->name('products.show');
    Route::post('shop/price', [SiteController::class, 'quote'])->middleware('throttle:60,1')->name('price');
    Route::post('shop/availability', [SiteController::class, 'check'])->middleware('throttle:60,1')->name('shop.availability');
    Route::post('shop/orders', [SiteCartController::class, 'shopOrder'])->middleware(['throttle:10,1', 'captcha'])->name('orders.store');
    Route::get('shop/orders/{code}', [SiteCartController::class, 'order'])->name('orders.show');
    Route::post('shop/orders/{code}/payments', [SiteCartController::class, 'pay'])->middleware('throttle:10,1')->name('orders.pay');
});
