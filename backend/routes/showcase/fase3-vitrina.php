<?php

declare(strict_types=1);

use App\Domain\Showcase\Http\Controllers\ShowcasePublicController;
use Illuminate\Support\Facades\Route;

Route::prefix('showcase')->middleware('throttle:public')->name('vitrina.public.')->controller(ShowcasePublicController::class)->group(function (): void {
    Route::get('overview', 'overview')->name('overview');
    Route::get('listings', 'listings')->name('listings.index');
    Route::get('listings/{slug}', 'listing')->name('listings.show');
    Route::post('listings/{slug}/bookings', 'book')->middleware('throttle:20,1')->name('listings.bookings');
    Route::post('bookings/{token}/cancel', 'cancel')->middleware('throttle:20,1')->name('bookings.cancel');
    Route::get('posts', 'posts')->name('posts.index');
    Route::get('posts/{slug}', 'post')->name('posts.show');
    Route::post('agencies', 'register')->middleware('throttle:10,1')->name('agencies.store');
});
