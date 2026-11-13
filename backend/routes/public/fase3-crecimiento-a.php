<?php

declare(strict_types=1);

use App\Domain\Site\Http\Controllers\PublicPayController;
use App\Domain\Site\Http\Middleware\ScopeSiteTenant;
use Illuminate\Support\Facades\Route;

Route::middleware(['public.site', ScopeSiteTenant::class])->name('crecimiento-a.')->controller(PublicPayController::class)->group(function (): void {
    Route::get('pay/{token}', 'show')->middleware('throttle:60,1')->name('pay.show');
    Route::post('pay/{token}/checkout', 'checkout')->middleware('throttle:10,1')->name('pay.checkout');
    Route::post('gift-cards', 'buyGiftCard')->middleware('throttle:10,1')->name('gift-cards.store');
    Route::post('gift-cards/balance', 'giftCardBalance')->middleware('throttle:10,1')->name('gift-cards.balance');
});
