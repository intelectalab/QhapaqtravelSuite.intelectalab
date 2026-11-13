<?php

declare(strict_types=1);

use App\Domain\Marketing\Http\Controllers\PublicUnsubscribeController;
use App\Domain\Site\Http\Middleware\ScopeSiteTenant;
use Illuminate\Support\Facades\Route;

Route::middleware(['public.site', ScopeSiteTenant::class])->name('plataforma.unsubscribe.')->controller(PublicUnsubscribeController::class)->group(function (): void {
    Route::get('unsubscribe/{token}', 'show')->middleware('throttle:30,1')->name('show');
    Route::post('unsubscribe/{token}', 'store')->middleware('throttle:20,1')->name('store');
});
