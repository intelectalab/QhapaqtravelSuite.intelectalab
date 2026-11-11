<?php

declare(strict_types=1);

use App\Domain\Channels\Http\Controllers\B2bAgencyController;
use Illuminate\Support\Facades\Route;

Route::get('channels/b2b/settlement-requests', [B2bAgencyController::class, 'settlements'])->middleware('permission:channels.b2b.manage|finance.commissions')->name('channels.b2b.settlements');

Route::middleware('permission:channels.b2b.manage')->group(function (): void {
    Route::get('channels/b2b/summary', [B2bAgencyController::class, 'summary'])->name('channels.b2b.summary');
    Route::get('channels/b2b/agencies', [B2bAgencyController::class, 'agencies'])->name('channels.b2b.agencies.index');
    Route::get('channels/b2b/agencies/{code}', [B2bAgencyController::class, 'show'])->name('channels.b2b.agencies.show');
    Route::get('channels/b2b/agencies/{code}/credit-movements', [B2bAgencyController::class, 'movements'])->name('channels.b2b.agencies.credit-movements');
    Route::post('channels/b2b/agencies/{code}/impersonation', [B2bAgencyController::class, 'impersonate'])->middleware('throttle:10,1')->name('channels.b2b.agencies.impersonation');
    Route::get('channels/b2b', [B2bAgencyController::class, 'index'])->name('channels.b2b.index');
    Route::post('channels/b2b/agencies', [B2bAgencyController::class, 'store'])->name('channels.b2b.store');
    Route::patch('channels/b2b/agencies/{code}', [B2bAgencyController::class, 'update'])->name('channels.b2b.update');
    Route::post('channels/b2b/agencies/{code}/block', [B2bAgencyController::class, 'block'])->name('channels.b2b.block');
    Route::post('channels/b2b/agencies/{code}/unblock', [B2bAgencyController::class, 'unblock'])->name('channels.b2b.unblock');
    Route::delete('channels/b2b/agencies/{code}', [B2bAgencyController::class, 'destroy'])->name('channels.b2b.destroy');
});
