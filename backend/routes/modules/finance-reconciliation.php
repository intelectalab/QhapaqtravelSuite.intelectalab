<?php

declare(strict_types=1);

use App\Domain\Finance\Http\Controllers\ReconciliationController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:finance.payments.register|finance.profitability')->group(function (): void {
    Route::get('finance/bank-lines', [ReconciliationController::class, 'index'])->name('finance.reconciliation.index');
    Route::middleware('permission:finance.payments.register')->group(function (): void {
        Route::post('finance/bank-statements', [ReconciliationController::class, 'import'])->name('finance.reconciliation.import');
        Route::post('finance/reconciliation/matching', [ReconciliationController::class, 'matching'])->name('finance.reconciliation.matching');
        Route::get('finance/reconciliation/closures', [ReconciliationController::class, 'closures'])->name('finance.reconciliation.closures.index');
        Route::post('finance/reconciliation/closures', [ReconciliationController::class, 'close'])->name('finance.reconciliation.closures.store');
        Route::get('finance/bank-lines/{code}/candidates', [ReconciliationController::class, 'candidates'])->name('finance.reconciliation.candidates');
        Route::post('finance/bank-lines/{code}/confirm', [ReconciliationController::class, 'confirm'])->name('finance.reconciliation.confirm');
        Route::post('finance/bank-lines/{code}/reject', [ReconciliationController::class, 'reject'])->name('finance.reconciliation.reject');
        Route::post('finance/bank-lines/{code}/resolve', [ReconciliationController::class, 'resolve'])->name('finance.reconciliation.resolve');
    });
});
