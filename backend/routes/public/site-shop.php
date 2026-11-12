<?php

declare(strict_types=1);

use App\Domain\Site\Http\Controllers\SiteController;
use App\Domain\Site\Http\Middleware\ScopeSiteTenant;
use Illuminate\Support\Facades\Route;

Route::middleware(['public.site', ScopeSiteTenant::class])->name('site.shop.')->group(function (): void {
    Route::post('availability', [SiteController::class, 'check'])->middleware('throttle:60,1')->name('availability');
});
