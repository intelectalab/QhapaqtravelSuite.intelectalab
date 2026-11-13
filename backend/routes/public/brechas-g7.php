<?php

declare(strict_types=1);

use App\Domain\Site\Http\Controllers\SiteEngagementController;
use App\Domain\Site\Http\Middleware\ScopeSiteTenant;
use Illuminate\Support\Facades\Route;

Route::middleware(['public.site', ScopeSiteTenant::class])->group(function (): void {
    Route::get('chat/sessions/{session}', [SiteEngagementController::class, 'chatSession'])->middleware('throttle:60,1')->name('brechas-g7.chat.show');
});
