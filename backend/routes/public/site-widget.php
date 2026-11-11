<?php

declare(strict_types=1);

use App\Domain\Site\Http\Controllers\SiteWidgetController;
use App\Domain\Site\Http\Middleware\ScopeSiteTenant;
use Illuminate\Support\Facades\Route;

Route::middleware(['public.site', ScopeSiteTenant::class])->name('site.widget.')->controller(SiteWidgetController::class)->group(function (): void {
    Route::get('widget/config', 'config')->middleware('throttle:120,1')->name('config');
    Route::post('widget-handoffs', 'start')->middleware(['throttle:30,1', 'idempotent'])->name('handoffs.store');
    Route::post('carts', 'cart')->middleware(['throttle:30,1', 'idempotent'])->name('carts.store');
});
