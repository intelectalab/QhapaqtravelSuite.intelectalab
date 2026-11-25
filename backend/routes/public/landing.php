<?php

declare(strict_types=1);

use App\Domain\Landing\Http\Controllers\PublicLandingContentController;
use Illuminate\Support\Facades\Route;

Route::prefix('landing')->name('landing.')->controller(PublicLandingContentController::class)->group(function (): void {
    Route::get('blog', 'posts')->name('blog.index');
    Route::get('blog/{slug}', 'post')->name('blog.show');
    Route::post('blog/{slug}/read', 'read')->middleware('throttle:30,1')->name('blog.read');
    Route::post('blog/{slug}/rating', 'rate')->middleware('throttle:20,1')->name('blog.rating');
    Route::post('blog/{slug}/comments', 'comment')->middleware('throttle:10,1')->name('blog.comments.store');
    Route::post('comments/{id}/useful', 'useful')->middleware('throttle:30,1')->name('comments.useful');
    Route::post('newsletter', 'subscribe')->middleware('throttle:5,1')->name('newsletter.store');
    Route::post('newsletter/confirm/{token}', 'confirm')->middleware('throttle:20,1')->name('newsletter.confirm');
    Route::post('newsletter/unsubscribe', 'unsubscribe')->middleware('throttle:20,1')->name('newsletter.unsubscribe');
    Route::get('popups', 'popups')->name('popups.index');
    Route::post('popups/{code}/events', 'popupEvent')->middleware('throttle:60,1')->name('popups.events');
});
