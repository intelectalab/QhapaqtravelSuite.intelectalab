<?php

declare(strict_types=1);

use App\Domain\Channels\Http\Controllers\CmsController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:channels.cms.publish')->group(function (): void {
    Route::get('channels/cms', [CmsController::class, 'index'])->name('channels.cms.index');
    Route::post('channels/cms', [CmsController::class, 'store'])->name('channels.cms.store');
    Route::patch('channels/cms/{code}', [CmsController::class, 'update'])->name('channels.cms.update');
    Route::post('channels/cms/{code}/transition', [CmsController::class, 'transition'])->name('channels.cms.transition');
    Route::delete('channels/cms/{code}', [CmsController::class, 'destroy'])->name('channels.cms.destroy');
});
