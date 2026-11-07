<?php

declare(strict_types=1);

use App\Domain\Platform\Http\Controllers\PlatformSettingsController;
use Illuminate\Support\Facades\Route;

Route::controller(PlatformSettingsController::class)->group(function (): void {
    Route::get('search', 'search')->middleware('throttle:60,1')->name('search');
    Route::get('notifications', 'notifications')->name('notifications.index');
    Route::post('notifications/read-all', 'readNotifications')->name('notifications.read-all');
    Route::get('settings', 'settings')->name('settings.show');
    Route::patch('settings/{section}', 'updateSettings')->whereIn('section', ['issuer', 'taxes', 'notices'])->name('settings.update');
    Route::get('branding', 'branding')->name('branding.show');
    Route::put('branding', 'saveBranding')->name('branding.update');
    Route::post('branding/reset', 'resetBranding')->name('branding.reset');
});
