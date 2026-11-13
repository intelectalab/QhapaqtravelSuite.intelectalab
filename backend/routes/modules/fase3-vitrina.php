<?php

declare(strict_types=1);

use App\Domain\Showcase\Http\Controllers\GatewayController;
use App\Domain\Showcase\Http\Controllers\ShowcaseAgencyController;
use App\Domain\Showcase\Http\Controllers\SiteBrandController;
use App\Domain\Showcase\Http\Controllers\TravelStoryController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:channels.showcase.manage')->prefix('channels/showcase')->name('vitrina.showcase.')->controller(ShowcaseAgencyController::class)->group(function (): void {
    Route::get('listings', 'index')->name('listings.index');
    Route::post('listings', 'store')->name('listings.store');
    Route::patch('listings/{code}', 'update')->name('listings.update');
    Route::get('bookings', 'bookings')->name('bookings.index');
    Route::post('bookings/{code}/attendance', 'attendance')->name('bookings.attendance');
    Route::get('fees', 'fees')->name('fees');
});

Route::middleware('permission:cms.seo.manage')->prefix('cms')->name('vitrina.brand.')->controller(SiteBrandController::class)->group(function (): void {
    Route::get('domains', 'domains')->name('domains.index');
    Route::post('domains', 'storeDomain')->name('domains.store');
    Route::post('domains/{id}/verify', 'verifyDomain')->name('domains.verify');
    Route::delete('domains/{id}', 'retireDomain')->name('domains.destroy');
    Route::get('seo/pages', 'pages')->name('seo.pages.index');
    Route::patch('seo/pages/{id}', 'updatePage')->name('seo.pages.update');
    Route::post('seo/audit', 'audit')->name('seo.audit');
    Route::get('redirects', 'redirects')->name('redirects.index');
    Route::post('redirects', 'storeRedirect')->name('redirects.store');
    Route::delete('redirects/{id}', 'deleteRedirect')->name('redirects.destroy');
});

Route::prefix('cms/stories')->name('vitrina.stories.')->controller(TravelStoryController::class)->group(function (): void {
    Route::middleware('permission:cms.seo.manage|channels.cms.publish')->group(function (): void {
        Route::get('', 'index')->name('index');
        Route::post('', 'store')->name('store');
        Route::patch('{id}', 'update')->name('update');
        Route::delete('{id}', 'destroy')->name('destroy');
        Route::post('{id}/consent-request', 'requestConsent')->name('consent-request');
    });
    Route::middleware('permission:channels.cms.publish')->group(function (): void {
        Route::post('{id}/publish', 'publish')->name('publish');
        Route::post('{id}/unpublish', 'unpublish')->name('unpublish');
    });
});

Route::post('portal/client/stories/{id}/consent', [TravelStoryController::class, 'consent'])->middleware('throttle:20,1')->name('portal.vitrina.stories.consent');

Route::prefix('finance')->name('vitrina.gateways.')->controller(GatewayController::class)->group(function (): void {
    Route::middleware('permission:finance.gateways.manage')->group(function (): void {
        Route::get('gateways', 'index')->name('index');
        Route::post('gateways', 'store')->name('store');
        Route::patch('gateways/{id}', 'update')->name('update');
        Route::post('gateway-fees/import', 'import')->name('fees.import');
    });
    Route::get('gateway-fees', 'fees')->middleware('permission:finance.gateways.manage|finance.profitability')->name('fees.index');
});
