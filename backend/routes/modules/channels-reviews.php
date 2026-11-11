<?php

declare(strict_types=1);

use App\Domain\Channels\Http\Controllers\ReviewController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:channels.ecommerce.manage|crm.clients.manage')->group(function (): void {
    Route::get('reviews', [ReviewController::class, 'own'])->name('channels.reviews.own');
    Route::get('settings/own-reviews', [ReviewController::class, 'settings'])->name('channels.reviews.settings');
    Route::get('reviews/stats', [ReviewController::class, 'stats'])->name('channels.reviews.stats');
    Route::get('review-requests', [ReviewController::class, 'requests'])->name('channels.reviews.requests.index');
    Route::get('reviews/{code}', [ReviewController::class, 'show'])->name('channels.reviews.show');
    Route::get('channels/external-reviews', [ReviewController::class, 'external'])->name('channels.reviews.external');
    Route::put('channels/external-reviews/{id}/reply', [ReviewController::class, 'replyExternal'])->whereUuid('id')->name('channels.reviews.external.reply');
    Route::post('channels/external-reviews/{id}/mark-published', [ReviewController::class, 'publishExternal'])->whereUuid('id')->name('channels.reviews.external.published');

    Route::middleware('permission:channels.ecommerce.manage')->group(function (): void {
        Route::put('channels/external-reviews/widget', [ReviewController::class, 'externalWidget'])->name('channels.reviews.external.widget');
        Route::patch('settings/own-reviews', [ReviewController::class, 'updateSettings'])->name('channels.reviews.settings.update');
        Route::post('review-requests/schedule-pending', [ReviewController::class, 'schedulePending'])->name('channels.reviews.requests.schedule');
        Route::post('reviews/export-feed', [ReviewController::class, 'exportFeed'])->name('channels.reviews.export-feed');
        Route::post('reviews/{code}/publish', [ReviewController::class, 'publish'])->name('channels.reviews.publish');
        Route::post('reviews/{code}/reject', [ReviewController::class, 'reject'])->name('channels.reviews.reject');
        Route::post('reviews/{code}/hide', [ReviewController::class, 'hide'])->name('channels.reviews.hide');
        Route::put('reviews/{code}/reply', [ReviewController::class, 'reply'])->name('channels.reviews.reply');
        Route::post('review-requests/{code}/send', [ReviewController::class, 'sendRequest'])->name('channels.reviews.requests.send');
        Route::post('review-requests/{code}/cancel', [ReviewController::class, 'cancelRequest'])->name('channels.reviews.requests.cancel');
    });
});
