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
    Route::put('settings/form-protection', 'updateFormProtection')->name('settings.form-protection');
    Route::put('settings/outgoing-mail', 'updateOutgoingMail')->name('settings.outgoing-mail');
    Route::post('settings/outgoing-mail/test', 'testOutgoingMail')->middleware('throttle:6,1')->name('settings.outgoing-mail.test');
    Route::get('branding', 'branding')->name('branding.show');
    Route::put('branding', 'saveBranding')->name('branding.update');
    Route::post('branding/reset', 'resetBranding')->name('branding.reset');
});
