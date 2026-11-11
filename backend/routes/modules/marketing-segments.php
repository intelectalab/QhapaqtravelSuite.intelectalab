<?php

declare(strict_types=1);

use App\Domain\Marketing\Http\Controllers\SegmentController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:marketing.campaigns.manage')->group(function (): void {
    Route::get('marketing/segments', [SegmentController::class, 'index'])->name('marketing.segments.index');
    Route::post('marketing/segments', [SegmentController::class, 'store'])->name('marketing.segments.store');
    Route::post('marketing/segments/preview', [SegmentController::class, 'preview'])->name('marketing.segments.preview');
    Route::get('marketing/segments/{code}', [SegmentController::class, 'show'])->name('marketing.segments.show');
    Route::put('marketing/segments/{code}', [SegmentController::class, 'update'])->middleware('if-match:mkt_segments,code,code')->name('marketing.segments.update');
    Route::delete('marketing/segments/{code}', [SegmentController::class, 'destroy'])->middleware('if-match:mkt_segments,code,code')->name('marketing.segments.destroy');
    Route::post('marketing/segments/{code}/duplicate', [SegmentController::class, 'duplicate'])->name('marketing.segments.duplicate');
});
