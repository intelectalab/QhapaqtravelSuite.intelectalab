<?php

declare(strict_types=1);

use App\Domain\Site\Http\Controllers\SiteController;
use App\Domain\Site\Http\Controllers\SiteDesignController;
use App\Domain\Site\Http\Middleware\ScopeSiteTenant;
use Illuminate\Support\Facades\Route;

Route::middleware(['public.site', ScopeSiteTenant::class])->name('site.')->group(function (): void {
    Route::get('site', [SiteController::class, 'profile'])->name('profile');
    Route::get('home', [SiteController::class, 'home'])->name('home');
    Route::get('site/images/{id}', [SiteDesignController::class, 'image'])->whereUuid('id')->name('images.show');
    Route::get('form-options', [SiteController::class, 'formOptions'])->name('form-options');
    Route::get('offers', [SiteController::class, 'offers'])->name('offers');
    Route::get('posts', [SiteController::class, 'posts'])->name('posts.index');
    Route::get('posts/{slug}', [SiteController::class, 'post'])->name('posts.show');
    Route::get('pages/{slug}', [SiteController::class, 'page'])->name('pages.show');
    Route::get('cms/contents/{slug}', [SiteController::class, 'cmsContent'])->name('cms.contents.show');
    Route::get('cms/placements/{placement}', [SiteController::class, 'placement'])->name('cms.placements.show');
    Route::get('destinations', [SiteController::class, 'destinations'])->name('destinations.index');
    Route::get('destinations/{slug}', [SiteController::class, 'destination'])->name('destinations.show');
    Route::get('products', [SiteController::class, 'products'])->name('products.index');
    Route::get('products/{slug}', [SiteController::class, 'product'])->name('products.show');
    Route::get('products/{slug}/calendar', [SiteController::class, 'calendar'])->name('products.calendar');
    Route::get('products/{slug}/availability', [SiteController::class, 'availability'])->name('products.availability');
    Route::get('products/{slug}/departures', [SiteController::class, 'departures'])->name('products.departures');
    Route::get('departures/guaranteed', [SiteController::class, 'guaranteed'])->name('departures.guaranteed');
    Route::get('booking-rules', [SiteController::class, 'bookingRules'])->name('booking-rules');
    Route::get('currencies', [SiteController::class, 'currencies'])->name('currencies');
    Route::get('reviews', [SiteController::class, 'reviews'])->name('reviews.index');
    Route::post('price-quote', [SiteController::class, 'quote'])->name('price-quote');
});
