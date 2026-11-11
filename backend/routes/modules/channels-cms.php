<?php

declare(strict_types=1);

use App\Domain\Channels\Http\Controllers\CmsController;
use App\Domain\Channels\Support\CmsDirectory;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:channels.cms.publish')->group(function (): void {
    Route::get('cms/contents', [CmsController::class, 'index'])->name('channels.cms.index');
    Route::post('cms/contents', [CmsController::class, 'store'])->name('channels.cms.store');
    Route::get('cms/contents/{code}', [CmsController::class, 'show'])->name('channels.cms.show');
    Route::post('cms/contents/{code}/preview', [CmsController::class, 'preview'])->name('channels.cms.preview');
    Route::patch('cms/contents/{code}', [CmsController::class, 'update'])->name('channels.cms.update');
    Route::delete('cms/contents/{code}', [CmsController::class, 'destroy'])->name('channels.cms.destroy');

    foreach (array_keys(CmsDirectory::ACTIONS) as $action) {
        Route::post("cms/contents/{code}/{$action}", [CmsController::class, 'transition'])->defaults('action', $action)->name("channels.cms.{$action}");
    }
});
