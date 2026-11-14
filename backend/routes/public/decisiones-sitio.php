<?php

declare(strict_types=1);

use App\Domain\Channels\Http\Controllers\ReviewLinksController;
use App\Domain\Site\Http\Controllers\SiteTransferController;
use App\Domain\Site\Http\Middleware\ScopeSiteTenant;
use Illuminate\Support\Facades\Route;

Route::middleware(['public.site', ScopeSiteTenant::class])->name('sitio.')->group(function (): void {
    Route::post('orders/{code}/transfer-proof', [SiteTransferController::class, 'uploadOrder'])->middleware('throttle:10,1')->name('orders.transfer-proof');
    Route::post('reviews/by-token/{code}/external-click', [ReviewLinksController::class, 'click'])->middleware('throttle:30,1')->name('reviews.external-click');
});
