<?php

declare(strict_types=1);

use App\Domain\Showcase\Http\Controllers\AccessPassController;
use App\Domain\Showcase\Http\Controllers\PlatformShowcaseController;
use Illuminate\Support\Facades\Route;

Route::middleware('platform.user:verified,admin.tenant.manage')->name('vitrina.')->group(function (): void {
    Route::controller(AccessPassController::class)->group(function (): void {
        Route::get('access-passes', 'index')->name('passes.index');
        Route::post('access-passes', 'store')->name('passes.store');
        Route::post('access-passes/{code}/extend', 'extend')->name('passes.extend');
        Route::post('access-passes/{code}/convert', 'convert')->name('passes.convert');
        Route::post('access-passes/{code}/revoke', 'revoke')->name('passes.revoke');
        Route::patch('addons/{code}/billing', 'billing')->name('addons.billing');
    });

    Route::prefix('showcase')->name('showcase.')->controller(PlatformShowcaseController::class)->group(function (): void {
        Route::get('moderation', 'moderation')->name('moderation');
        Route::post('listings/{code}/decision', 'decide')->name('listings.decision');
        Route::post('agencies/{code}/verify', 'verify')->name('agencies.verify');
        Route::get('funnel', 'funnel')->name('funnel');
        Route::get('posts', 'posts')->name('posts.index');
        Route::post('posts', 'storePost')->name('posts.store');
        Route::patch('posts/{id}', 'updatePost')->name('posts.update');
    });
});
