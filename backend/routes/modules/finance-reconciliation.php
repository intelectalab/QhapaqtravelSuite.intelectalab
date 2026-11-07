<?php

declare(strict_types=1);

use App\Domain\Finance\Http\Controllers\ReconciliationController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:finance.payments.register|finance.profitability')->group(function (): void {
    Route::get('finance/bank-lines', [ReconciliationController::class, 'index'])->name('finance.reconciliation.index');
    Route::middleware('permission:finance.payments.register')->group(function (): void {
        Route::post('finance/bank-lines/{code}/confirm', [ReconciliationController::class, 'confirm'])->name('finance.reconciliation.confirm');
        Route::post('finance/bank-lines/{code}/reject', [ReconciliationController::class, 'reject'])->name('finance.reconciliation.reject');
        Route::post('finance/bank-lines/{code}/resolve', [ReconciliationController::class, 'resolve'])->name('finance.reconciliation.resolve');
    });
});
