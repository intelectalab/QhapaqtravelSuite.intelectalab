<?php

declare(strict_types=1);

use App\Domain\Portal\Http\Controllers\PortalController;
use Illuminate\Support\Facades\Route;

Route::prefix('portal/client')->name('portal.')->controller(PortalController::class)->group(function (): void {
    Route::get('session', 'session')->name('session');
    Route::get('home', 'home')->name('home');
    Route::get('reservations', 'trips')->middleware('permission:reservations.view')->name('trips.index');
    Route::get('reservations/{code}', 'trip')->middleware('permission:reservations.view')->name('trips.show');
    Route::get('quotes', 'quotes')->middleware('permission:quotes.view')->name('quotes.index');
    Route::get('quotes/{code}', 'quote')->middleware('permission:quotes.view')->name('quotes.show');
    Route::post('quotes/{code}/approve', 'approve')->middleware('permission:quotes.view')->name('quotes.approve');
    Route::post('quotes/{code}/reject', 'reject')->middleware('permission:quotes.view')->name('quotes.reject');
    Route::get('receivables', 'billing')->name('billing');
    Route::post('receivables/{code}/payments', 'reportPayment')->name('billing.payments.store');
    Route::get('profile', 'profile')->name('profile');
    Route::patch('profile', 'updateProfile')->name('profile.update');
    Route::put('profile/consents/{channel}', 'consent')->name('profile.consents.update');
    Route::get('tickets', 'messages')->name('messages.index');
    Route::post('tickets', 'sendMessage')->name('messages.store');
});
