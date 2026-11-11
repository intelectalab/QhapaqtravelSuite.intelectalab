<?php

declare(strict_types=1);

use App\Domain\Help\Http\Controllers\HelpController;
use Illuminate\Support\Facades\Route;

Route::controller(HelpController::class)->prefix('help')->name('help.')->group(function (): void {
    Route::get('articles', 'index')->name('articles.index');
    Route::get('screen', 'screen')->name('screen');
    Route::get('articles/{slug}', 'show')->name('articles.show');

    Route::middleware('permission:admin.settings.manage')->group(function (): void {
        Route::post('articles', 'store')->name('articles.store');
        Route::put('articles/{slug}', 'update')->name('articles.update');
        Route::post('articles/{slug}/archive', 'archive')->name('articles.archive');
        Route::post('articles/{slug}/restore', 'restore')->name('articles.restore');
        Route::delete('articles/{slug}/adaptation', 'original')->name('articles.original');
    });
});
