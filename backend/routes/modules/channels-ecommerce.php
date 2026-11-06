<?php

declare(strict_types=1);

use App\Domain\Channels\Http\Controllers\EcommerceController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:channels.ecommerce.manage')->group(function (): void {
    Route::get('channels/ecommerce', [EcommerceController::class, 'index'])->name('channels.ecommerce.index');
    Route::post('channels/ecommerce/products/{code}/publication', [EcommerceController::class, 'publish'])->name('channels.ecommerce.publish');
    Route::post('channels/ecommerce/orders/{code}/cancel', [EcommerceController::class, 'cancel'])->name('channels.ecommerce.cancel');
});
