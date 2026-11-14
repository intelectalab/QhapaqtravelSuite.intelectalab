<?php

declare(strict_types=1);

use App\Domain\Channels\Http\Controllers\ReviewLinksController;
use App\Domain\Inbox\Http\Controllers\InboxResponseTimesController;
use App\Domain\Site\Http\Controllers\SiteTransferController;
use Illuminate\Support\Facades\Route;

Route::name('sitio.')->group(function (): void {
    Route::middleware('permission:admin.settings.manage')->group(function (): void {
        Route::get('settings/transfer-validation', [SiteTransferController::class, 'settings'])->name('settings.transfer-validation.show');
        Route::put('settings/transfer-validation', [SiteTransferController::class, 'updateSettings'])->name('settings.transfer-validation.update');
        Route::get('inbox/response-times', [InboxResponseTimesController::class, 'show'])->name('inbox.response-times.show');
        Route::put('inbox/response-times', [InboxResponseTimesController::class, 'update'])->name('inbox.response-times.update');
    });

    Route::get('finance/payments/{code}/transfer-proof', [SiteTransferController::class, 'proof'])->middleware('permission:finance.receivables|finance.payments.register')->name('finance.payments.transfer-proof');

    Route::middleware('permission:finance.payments.register')->group(function (): void {
        Route::get('reservations/{code}/web-reactivation', [SiteTransferController::class, 'reactivation'])->name('reservations.web-reactivation.show');
        Route::post('reservations/{code}/web-reactivation', [SiteTransferController::class, 'reactivate'])->name('reservations.web-reactivation.store');
    });

    Route::middleware('permission:channels.ecommerce.manage|crm.clients.manage')->group(function (): void {
        Route::get('channels/review-links', [ReviewLinksController::class, 'show'])->name('channels.review-links.show');
        Route::get('channels/review-invitations', [ReviewLinksController::class, 'invitations'])->name('channels.review-invitations.index');

        Route::middleware('permission:channels.ecommerce.manage')->group(function (): void {
            Route::put('channels/review-links', [ReviewLinksController::class, 'update'])->name('channels.review-links.update');
            Route::post('channels/review-links/test', [ReviewLinksController::class, 'test'])->middleware('throttle:30,1')->name('channels.review-links.test');
        });
    });
});

Route::prefix('public')->name('public.me.sitio.')->group(function (): void {
    Route::post('me/payments/{code}/transfer-proof', [SiteTransferController::class, 'uploadAccount'])->middleware('throttle:10,1')->name('payments.transfer-proof');
});
