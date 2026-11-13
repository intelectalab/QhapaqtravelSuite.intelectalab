<?php

declare(strict_types=1);

use App\Domain\Landing\Http\Controllers\PlatformSignupController;
use App\Domain\Tracking\Http\Controllers\PlatformTrackingController;
use Illuminate\Support\Facades\Route;

Route::middleware('platform.user:verified,admin.tenant.manage')->name('seguimiento.')->group(function (): void {
    Route::controller(PlatformTrackingController::class)->group(function (): void {
        Route::get('tracking/tags', 'index')->name('tags.index');
        Route::post('tracking/tags', 'store')->name('tags.store');
        Route::patch('tracking/tags/{code}', 'update')->name('tags.update');
        Route::post('tracking/tags/{code}/decision', 'decision')->name('tags.decision');
        Route::put('tracking/conversions/{tag}/{event}', 'map')->name('conversions.replace');
        Route::get('analytics/web/overview', 'overview')->name('analytics.overview');
        Route::get('analytics/web/agencies', 'agencies')->name('analytics.agencies');
        Route::get('blog/sync-status', 'blogStatus')->name('blog.sync-status');
    });

    Route::get('signups', [PlatformSignupController::class, 'index'])->name('signups.index');
});
