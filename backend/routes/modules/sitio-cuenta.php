<?php

declare(strict_types=1);

use App\Domain\Site\Http\Controllers\SiteAccountController;
use Illuminate\Support\Facades\Route;

Route::prefix('public')->name('public.me.')->controller(SiteAccountController::class)->group(function (): void {
    Route::post('auth/logout', 'logout')->name('logout');
    Route::post('auth/email/resend', 'resendVerification')->middleware('throttle:3,1')->name('email.resend');
    Route::get('me', 'me')->name('show');
    Route::patch('me', 'update')->name('update');
    Route::get('me/reservations', 'reservations')->name('reservations.index');
    Route::get('me/reservations/{code}', 'reservation')->name('reservations.show');
    Route::get('me/vouchers', 'vouchers')->name('vouchers.index');
    Route::get('me/vouchers/{code}.pdf', 'voucherPdf')->name('vouchers.pdf');
    Route::get('me/receivables', 'receivables')->name('receivables.index');
    Route::post('me/receivables/{id}/payments', 'pay')->middleware('throttle:10,1')->name('receivables.payments.store');
    Route::get('me/wishlist', 'wishlist')->name('wishlist.index');
    Route::put('me/wishlist/{product}', 'wish')->name('wishlist.update');
    Route::delete('me/wishlist/{product}', 'unwish')->name('wishlist.destroy');
});
