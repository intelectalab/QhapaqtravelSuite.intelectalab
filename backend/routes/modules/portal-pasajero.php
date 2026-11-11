<?php

declare(strict_types=1);

use App\Domain\Portal\Http\Controllers\PassengerPortalController;
use Illuminate\Support\Facades\Route;

Route::prefix('passenger/reviews')->name('portal.passenger.reviews.contract.')->controller(PassengerPortalController::class)->group(function (): void {
    Route::get('eligibility', 'reviews')->name('eligibility');
    Route::post('/', 'sendReview')->middleware('throttle:10,1')->name('store');
});

Route::prefix('portal/passenger')->name('portal.passenger.')->controller(PassengerPortalController::class)->group(function (): void {
    Route::get('feedback', 'feedback')->name('feedback.index');
    Route::post('feedback', 'sendFeedback')->middleware('throttle:10,1')->name('feedback.store');
    Route::get('reviews', 'reviews')->name('reviews.index');
    Route::post('reviews', 'sendReview')->middleware('throttle:10,1')->name('reviews.store');
    Route::get('trip', 'trip')->name('trip');
    Route::get('itinerary', 'itinerary')->name('itinerary');
    Route::get('hotels', 'hotels')->name('hotels');
    Route::get('transport', 'transport')->name('transport');
    Route::get('activities', 'activities')->name('activities');
    Route::get('vouchers', 'vouchers')->name('vouchers.index');
    Route::get('vouchers/{code}', 'voucher')->name('vouchers.show');
    Route::get('documents', 'documents')->name('documents');
    Route::get('alerts', 'alerts')->name('alerts.index');
    Route::post('alerts/{incidentId}/ack', 'ack')->name('alerts.ack');
    Route::get('contacts', 'contacts')->name('contacts');
    Route::get('messages', 'messages')->name('messages.index');
    Route::post('messages', 'sendMessage')->middleware('throttle:20,1')->name('messages.store');
    Route::post('messages/read-all', 'readAll')->name('messages.read-all');
    Route::post('messages/{id}/read', 'readMessage')->name('messages.read');
    Route::get('companions', 'companions')->name('companions.show');
    Route::put('companions', 'updateCompanions')->name('companions.update');
});
