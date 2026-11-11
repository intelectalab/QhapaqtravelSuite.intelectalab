<?php

declare(strict_types=1);

use App\Domain\Channels\Http\Controllers\EcommerceController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:channels.ecommerce.manage')->group(function (): void {
    Route::get('channels/ecommerce', [EcommerceController::class, 'index'])->name('channels.ecommerce.index');
    Route::post('channels/ecommerce/products/{code}/publish', [EcommerceController::class, 'publish'])->name('channels.ecommerce.publish');
    Route::post('channels/ecommerce/products/{code}/unpublish', [EcommerceController::class, 'unpublish'])->name('channels.ecommerce.unpublish');
    Route::post('channels/ecommerce/orders/{code}/cancel', [EcommerceController::class, 'cancel'])->name('channels.ecommerce.cancel');
    Route::get('channels/ecommerce/summary', [EcommerceController::class, 'summary'])->name('channels.ecommerce.summary');
    Route::get('channels/ecommerce/orders', [EcommerceController::class, 'orders'])->name('channels.ecommerce.orders.index');
    Route::get('channels/ecommerce/orders/{code}', [EcommerceController::class, 'order'])->name('channels.ecommerce.orders.show');
    Route::get('channels/ecommerce/products', [EcommerceController::class, 'products'])->name('channels.ecommerce.products.index');
    Route::post('channels/ecommerce/orders/{code}/payment-link', [EcommerceController::class, 'paymentLink'])->middleware('throttle:10,1')->name('channels.ecommerce.payment-link');
});
