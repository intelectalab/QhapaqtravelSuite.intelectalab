<?php

declare(strict_types=1);

use App\Domain\Channels\Http\Controllers\ReviewController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:channels.ecommerce.manage|crm.clients.manage')->group(function (): void {
    Route::get('channels/own-reviews', [ReviewController::class, 'own'])->name('channels.reviews.own');
    Route::get('channels/external-reviews', [ReviewController::class, 'external'])->name('channels.reviews.external');
    Route::put('channels/external-reviews/{id}/reply', [ReviewController::class, 'replyExternal'])->whereUuid('id')->name('channels.reviews.external.reply');
    Route::post('channels/external-reviews/{id}/mark-published', [ReviewController::class, 'publishExternal'])->whereUuid('id')->name('channels.reviews.external.published');

    Route::middleware('permission:channels.ecommerce.manage')->group(function (): void {
        Route::post('channels/own-reviews/{code}/moderate', [ReviewController::class, 'moderate'])->name('channels.reviews.moderate');
        Route::put('channels/own-reviews/{code}/reply', [ReviewController::class, 'reply'])->name('channels.reviews.reply');
        Route::post('channels/review-requests/{code}', [ReviewController::class, 'requestAction'])->name('channels.reviews.requests');
    });
});
