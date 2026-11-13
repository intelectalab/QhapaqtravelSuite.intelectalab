<?php

declare(strict_types=1);

use App\Domain\Landing\Http\Controllers\PublicLandingController;
use App\Domain\Tracking\Http\Controllers\PublicTrackingController;
use App\Domain\Tracking\Http\Middleware\ResolveTrackingSite;
use Illuminate\Support\Facades\Route;

Route::name('seguimiento.')->group(function (): void {
    Route::middleware(ResolveTrackingSite::class)->controller(PublicTrackingController::class)->group(function (): void {
        Route::get('site/tags', 'tags')->middleware('throttle:120,1')->name('site-tags');
        Route::post('analytics/hit', 'hit')->middleware('throttle:120,1')->name('analytics-hit');
        Route::post('consent', 'consent')->middleware('throttle:30,1')->name('consent');
    });

    Route::controller(PublicLandingController::class)->group(function (): void {
        Route::get('plans', 'plans')->name('plans');
        Route::post('coupons/validate', 'coupon')->middleware('throttle:10,1')->name('coupons.validate');
        Route::get('ruc/{ruc}', 'ruc')->middleware('throttle:10,1')->name('ruc');
        Route::post('signups', 'signup')->middleware(['throttle:10,1', 'captcha'])->name('signups.store');
        Route::get('signups/{token}', 'show')->middleware('throttle:60,1')->name('signups.show');
        Route::post('signups/{token}/checkout', 'checkout')->middleware('throttle:10,1')->name('signups.checkout');
        Route::post('sales-leads', 'salesLead')->middleware('throttle:5,1')->name('sales-leads.store');
    });
});
