<?php

declare(strict_types=1);

use App\Domain\Crm\Http\Controllers\ClaimBookController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:crm.claims.manage')->group(function (): void {
    Route::get('crm/claims', [ClaimBookController::class, 'index'])->name('crm.claims.index');
    Route::post('crm/claims', [ClaimBookController::class, 'store'])->name('crm.claims.store');
    Route::patch('crm/claims/{code}', [ClaimBookController::class, 'update'])->name('crm.claims.update');
    Route::post('crm/claims/{code}/evaluate', [ClaimBookController::class, 'evaluate'])->name('crm.claims.evaluate');
    Route::post('crm/claims/{code}/respond', [ClaimBookController::class, 'respond'])->name('crm.claims.respond');
    Route::post('crm/claims/{code}/close', [ClaimBookController::class, 'close'])->name('crm.claims.close');
});
