<?php

declare(strict_types=1);

use App\Domain\Channels\Http\Controllers\PortalController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:channels.b2b.manage|channels.cms.publish|operations.assign')->group(function (): void {
    Route::post('channels/passenger-portal/preview', [PortalController::class, 'previewPassenger'])->middleware('throttle:10,1')->name('brechas-g7.passenger-portal.preview');
});
