<?php

declare(strict_types=1);

use App\Domain\Site\Http\Controllers\SiteAccountController;
use App\Domain\Site\Http\Middleware\ScopeSiteTenant;
use Illuminate\Support\Facades\Route;

Route::middleware(['public.site', ScopeSiteTenant::class])->name('site.account.')->controller(SiteAccountController::class)->group(function (): void {
    Route::post('auth/register', 'register')->middleware('throttle:5,1')->name('register');
    Route::post('auth/login', 'login')->middleware('throttle:5,1')->name('login');
    Route::post('auth/password/forgot', 'forgot')->middleware('throttle:5,1')->name('password.forgot');
    Route::post('auth/email/verify', 'verify')->middleware('throttle:10,1')->name('email.verify');
    Route::post('orders/lookup', 'lookup')->middleware('throttle:5,1')->name('orders.lookup');
});
