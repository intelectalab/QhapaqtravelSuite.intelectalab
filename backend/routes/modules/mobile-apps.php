<?php

declare(strict_types=1);

use App\Domain\Mobile\Http\Controllers\MobilePreviewController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:operations.assign')->group(function (): void {
    Route::get('mobile/operator', [MobilePreviewController::class, 'operator'])->name('mobile.operator');
    Route::get('mobile/passenger', [MobilePreviewController::class, 'passenger'])->name('mobile.passenger');
});
