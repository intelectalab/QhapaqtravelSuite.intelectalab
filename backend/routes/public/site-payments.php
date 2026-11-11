<?php

declare(strict_types=1);

use App\Domain\Site\Http\Controllers\SiteCartController;
use App\Domain\Site\Http\Middleware\ScopeSiteTenant;
use Illuminate\Support\Facades\Route;

Route::middleware(['public.site', ScopeSiteTenant::class])->name('site.payments.')->group(function (): void {
    Route::post('orders/{code}/payment-session', [SiteCartController::class, 'paymentSession'])->middleware(['throttle:10,1', 'idempotent'])->name('session');
});
