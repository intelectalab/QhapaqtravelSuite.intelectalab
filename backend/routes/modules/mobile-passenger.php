<?php

declare(strict_types=1);

use App\Domain\Documents\Http\Controllers\DocumentController;
use App\Domain\Portal\Http\Controllers\PassengerPortalController;
use Illuminate\Support\Facades\Route;

Route::prefix('mobile/passenger')->name('mobile.passenger.')->group(function (): void {
    Route::controller(PassengerPortalController::class)->group(function (): void {
        Route::get('trip', 'trip')->name('trip');
        Route::get('itinerary', 'itinerary')->name('itinerary');
        Route::get('vouchers', 'vouchers')->name('vouchers.index');
        Route::get('vouchers/{code}', 'voucher')->name('vouchers.show');
        Route::get('documents', 'documents')->name('documents.index');
        Route::get('alerts', 'alerts')->name('alerts.index');
        Route::post('alerts/{incidentId}/read', 'ack')->name('alerts.read');
        Route::get('messages', 'messages')->name('messages.index');
        Route::post('messages', 'sendMessage')->middleware('throttle:20,1')->name('messages.store');
        Route::post('messages/{id}/read', 'readMessage')->name('messages.read');
        Route::get('support', 'contacts')->name('support');
        Route::post('feedback', 'sendFeedback')->middleware('throttle:10,1')->name('feedback.store');
    });
    Route::get('documents/{id}/download', [DocumentController::class, 'passengerDocument'])->name('documents.download');
});
