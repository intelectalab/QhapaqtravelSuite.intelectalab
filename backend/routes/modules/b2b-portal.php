<?php

declare(strict_types=1);

use App\Domain\B2bPortal\Http\Controllers\B2bPortalController;
use Illuminate\Support\Facades\Route;

Route::prefix('b2b')->name('b2b.')->controller(B2bPortalController::class)->group(function (): void {
    Route::get('session', 'session')->name('session');
    Route::get('home', 'home')->name('home');
    Route::get('catalog', 'catalog')->middleware('permission:catalog.products.view')->name('catalog.index');
    Route::get('catalog/{code}', 'product')->middleware('permission:catalog.products.view')->name('catalog.show');
    Route::post('reservations/quote-price', 'simulate')->middleware('permission:quotes.create')->name('reservations.simulate');
    Route::post('reservations', 'store')->middleware('permission:reservations.create')->name('reservations.store');
    Route::get('reservations', 'reservations')->middleware('permission:reservations.view')->name('reservations.index');
    Route::get('reservations/{code}', 'reservation')->middleware('permission:reservations.view')->name('reservations.show');
    Route::put('reservations/{code}/passengers/{seq}', 'passenger')->whereNumber('seq')->middleware('permission:reservations.create')->name('reservations.passengers.update');
    Route::post('reservations/{code}/cancel-request', 'cancel')->middleware('permission:reservations.create')->name('reservations.cancel');
    Route::delete('reservations/{code}/cancel-request', 'withdrawCancel')->middleware('permission:reservations.create')->name('reservations.cancel.withdraw');
    Route::get('statement', 'statement')->name('statement');
    Route::post('receivables/{code}/payment-reports', 'reportPayment')->name('receivables.payments.store');
    Route::post('settlement-requests', 'settle')->name('settlements.store');
    Route::get('agency', 'agency')->name('agency');
});
