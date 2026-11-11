<?php

declare(strict_types=1);

use App\Domain\Channels\Http\Controllers\PortalController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:channels.b2b.manage|channels.cms.publish|crm.clients.manage')
    ->get('channels/customer-portal', [PortalController::class, 'customer'])
    ->name('channels.portal.customer');

Route::middleware('permission:channels.b2b.manage|channels.cms.publish|crm.clients.manage')->group(function (): void {
    Route::get('channels/portal-preview/clients', [PortalController::class, 'previewClients'])->name('channels.portal.preview.clients');
    Route::get('channels/portal-preview/clients/{code}/{section}', [PortalController::class, 'previewSection'])->name('channels.portal.preview.section');
});

Route::middleware('permission:channels.b2b.manage|channels.cms.publish|operations.assign')->group(function (): void {
    Route::get('channels/passenger-portal', [PortalController::class, 'passenger'])->name('channels.portal.passenger');
    Route::put('channels/passenger-portal/feedback/{code}/reply', [PortalController::class, 'reply'])->name('channels.portal.feedback.reply');
    Route::post('channels/passenger-portal/feedback/{code}/status', [PortalController::class, 'mark'])->name('channels.portal.feedback.status');
});
