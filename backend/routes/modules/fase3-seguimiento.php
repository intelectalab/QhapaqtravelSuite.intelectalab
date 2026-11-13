<?php

declare(strict_types=1);

use App\Domain\Tracking\Http\Controllers\TrackingController;
use App\Domain\Tracking\Http\Controllers\WebAnalyticsController;
use Illuminate\Support\Facades\Route;

Route::prefix('marketing/tracking')->name('seguimiento.')->controller(TrackingController::class)->group(function (): void {
    Route::middleware('permission:marketing.tracking.manage')->group(function (): void {
        Route::get('tags', 'index')->name('tags.index');
        Route::post('tags', 'store')->name('tags.store');
        Route::get('tags/{code}', 'show')->name('tags.show');
        Route::patch('tags/{code}', 'update')->name('tags.update');
        Route::delete('tags/{code}', 'destroy')->name('tags.destroy');
        Route::post('tags/{code}/submit', 'submit')->name('tags.submit');
        Route::post('tags/{code}/pause', 'pause')->name('tags.pause');
        Route::post('tags/{code}/verify', 'verify')->middleware('throttle:20,1')->name('tags.verify');
        Route::get('conversions', 'conversions')->name('conversions.index');
        Route::put('conversions/{tag}/{event}', 'map')->name('conversions.replace');
        Route::delete('conversions/{tag}/{event}', 'unmap')->name('conversions.destroy');
        Route::get('dispatches', 'dispatches')->name('dispatches.index');
        Route::post('dispatches/{id}/retry', 'retry')->name('dispatches.retry');
    });

    Route::post('tags/{code}/decision', 'decision')->middleware('permission:marketing.tracking.approve')->name('tags.decision');
});

Route::prefix('analytics/web')->name('seguimiento.visitas.')->middleware('permission:analytics.web.view')->controller(WebAnalyticsController::class)->group(function (): void {
    Route::get('overview', 'overview')->name('overview');
    Route::get('pages', 'pages')->name('pages');
    Route::get('sources', 'sources')->name('sources');
    Route::get('devices', 'devices')->name('devices');
    Route::get('realtime', 'realtime')->name('realtime');
    Route::get('export', 'export')->middleware('throttle:20,1')->name('export');
});
