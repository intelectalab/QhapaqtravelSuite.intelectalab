<?php

declare(strict_types=1);

use App\Domain\Landing\Http\Controllers\PlatformLandingController;
use Illuminate\Support\Facades\Route;

Route::prefix('landing')->name('landing.')->controller(PlatformLandingController::class)->middleware('platform.user:verified,admin.tenant.manage')->group(function (): void {
    Route::get('comments', 'comments')->name('comments.index');
    Route::post('comments/{id}/moderate', 'moderate')->name('comments.moderate');
    Route::post('comments/{id}/reply', 'reply')->name('comments.reply');
    Route::delete('comments/{id}', 'destroyComment')->name('comments.destroy');
    Route::get('popups', 'popups')->name('popups.index');
    Route::post('popups', 'storePopup')->name('popups.store');
    Route::patch('popups/{code}', 'updatePopup')->name('popups.update');
    Route::post('popups/{code}/status', 'popupStatus')->name('popups.status');
    Route::delete('popups/{code}', 'destroyPopup')->name('popups.destroy');
    Route::get('subscribers', 'subscribers')->name('subscribers.index');
    Route::get('posts', 'posts')->name('posts.index');
    Route::post('posts', 'storePost')->name('posts.store');
    Route::patch('posts/{id}', 'updatePost')->name('posts.update');
    Route::post('posts/{id}/status', 'postStatus')->name('posts.status');
    Route::delete('posts/{id}', 'destroyPost')->name('posts.destroy');
});
