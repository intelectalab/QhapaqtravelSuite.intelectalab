<?php

declare(strict_types=1);

use App\Domain\Operations\Http\Controllers\ResourceController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:operations.view')->prefix('ops')->group(function (): void {
    Route::get('resources', [ResourceController::class, 'index'])->name('ops.resources.index');
    Route::get('resources/availability', [ResourceController::class, 'availability'])->name('ops.resources.availability');

    Route::middleware('permission:operations.assign')->group(function (): void {
        Route::post('resources/{type}', [ResourceController::class, 'store'])->name('ops.resources.store');
        Route::patch('resources/{type}/{id}', [ResourceController::class, 'update'])->name('ops.resources.update');
        Route::delete('resources/{type}/{id}', [ResourceController::class, 'destroy'])->name('ops.resources.destroy');
    });
});
