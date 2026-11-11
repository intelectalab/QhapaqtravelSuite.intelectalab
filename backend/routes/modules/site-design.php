<?php

declare(strict_types=1);

use App\Domain\Site\Http\Controllers\SiteDesignController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:admin.settings.manage')->prefix('admin/site-design')->name('admin.site-design.')->group(function (): void {
    Route::get('/', [SiteDesignController::class, 'show'])->name('show');
    Route::put('draft', [SiteDesignController::class, 'saveDraft'])->name('draft');
    Route::post('publish', [SiteDesignController::class, 'publish'])->name('publish');
    Route::post('discard', [SiteDesignController::class, 'discard'])->name('discard');
    Route::post('versions/{version}/restore', [SiteDesignController::class, 'restore'])->whereNumber('version')->name('restore');
    Route::get('preview', [SiteDesignController::class, 'preview'])->name('preview');
    Route::post('images', [SiteDesignController::class, 'upload'])->name('images.store');
    Route::delete('images/{id}', [SiteDesignController::class, 'destroyImage'])->whereUuid('id')->name('images.destroy');
});
