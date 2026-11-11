<?php

declare(strict_types=1);

use App\Domain\Site\Http\Controllers\SiteReviewController;
use App\Domain\Site\Http\Middleware\ScopeSiteTenant;
use Illuminate\Support\Facades\Route;

Route::middleware(['public.site', ScopeSiteTenant::class])->name('site.reviews.')->controller(SiteReviewController::class)->group(function (): void {
    Route::get('reviews/by-token/{code}', 'show')->middleware('throttle:30,1')->name('by-token.show');
    Route::post('reviews/by-token', 'store')->middleware(['throttle:10,1', 'idempotent'])->name('by-token.store');
});
