<?php

declare(strict_types=1);

use App\Domain\Site\Http\Controllers\SiteEngagementController;
use App\Domain\Site\Http\Middleware\ScopeSiteTenant;
use Illuminate\Support\Facades\Route;

Route::middleware(['public.site', ScopeSiteTenant::class])->name('site.engagement.')->controller(SiteEngagementController::class)->group(function (): void {
    Route::post('chat/sessions', 'openChat')->middleware('throttle:5,1')->name('chat.open');
    Route::post('chat/sessions/{session}/messages', 'chatMessage')->middleware('throttle:30,1')->name('chat.messages');
    Route::post('analytics/events', 'events')->middleware('throttle:120,1')->name('analytics');
    Route::get('newsletter/confirm/{token}', 'confirmNewsletter')->middleware('throttle:20,1')->name('newsletter.confirm');
    Route::post('newsletter/unsubscribe', 'unsubscribeNewsletter')->middleware('throttle:20,1')->name('newsletter.unsubscribe');
});
