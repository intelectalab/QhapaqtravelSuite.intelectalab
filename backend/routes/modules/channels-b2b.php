<?php

declare(strict_types=1);

use App\Domain\Channels\Http\Controllers\B2bAgencyController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:channels.b2b.manage')->group(function (): void {
    Route::get('channels/b2b', [B2bAgencyController::class, 'index'])->name('channels.b2b.index');
    Route::post('channels/b2b/agencies', [B2bAgencyController::class, 'store'])->name('channels.b2b.store');
    Route::patch('channels/b2b/agencies/{code}', [B2bAgencyController::class, 'update'])->name('channels.b2b.update');
    Route::post('channels/b2b/agencies/{code}/block', [B2bAgencyController::class, 'block'])->name('channels.b2b.block');
    Route::post('channels/b2b/agencies/{code}/unblock', [B2bAgencyController::class, 'unblock'])->name('channels.b2b.unblock');
    Route::delete('channels/b2b/agencies/{code}', [B2bAgencyController::class, 'destroy'])->name('channels.b2b.destroy');
});
