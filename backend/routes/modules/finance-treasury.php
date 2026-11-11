<?php

declare(strict_types=1);

use App\Domain\Finance\Http\Controllers\TreasuryController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:finance.treasury')->group(function (): void {
    Route::get('treasury/accounts', [TreasuryController::class, 'index'])->name('finance.treasury.index');
    Route::post('treasury/accounts', [TreasuryController::class, 'storeAccount'])->name('finance.treasury.accounts.store');
    Route::patch('treasury/accounts/{code}', [TreasuryController::class, 'updateAccount'])->name('finance.treasury.accounts.update');
    Route::get('treasury/accounts/{code}/movements', [TreasuryController::class, 'ledger'])->name('finance.treasury.accounts.movements');
    Route::get('treasury/cash-flow', [TreasuryController::class, 'cashFlow'])->name('finance.treasury.cash-flow');
    Route::post('treasury/movements', [TreasuryController::class, 'store'])->name('finance.treasury.movements.store');
    Route::post('treasury/movements/{code}/void', [TreasuryController::class, 'void'])->name('finance.treasury.movements.void');
    Route::post('treasury/transfers', [TreasuryController::class, 'transfer'])->name('finance.treasury.transfers.store');
    Route::post('treasury/gateway/{account}/settlements', [TreasuryController::class, 'settle'])->name('finance.treasury.gateway.settle');
    Route::post('treasury/petty-cash/{account}/sessions', [TreasuryController::class, 'openSession'])->name('finance.treasury.sessions.store');
    Route::post('treasury/petty-cash/{account}/expenses', [TreasuryController::class, 'expense'])->name('finance.treasury.expenses.store');
    Route::post('treasury/petty-cash/{account}/counts', [TreasuryController::class, 'count'])->name('finance.treasury.counts.store');
    Route::post('treasury/counts/{code}/approve', [TreasuryController::class, 'approveCount'])->name('finance.treasury.counts.approve');
    Route::post('treasury/counts/{code}/validate', [TreasuryController::class, 'validateCount'])->name('finance.treasury.counts.validate');
    Route::post('treasury/petty-cash/{account}/replenishments', [TreasuryController::class, 'requestReplenishment'])->name('finance.treasury.replenishments.store');
    Route::post('treasury/replenishments/{code}/approve', [TreasuryController::class, 'approveReplenishment'])->name('finance.treasury.replenishments.approve');
    Route::post('treasury/replenishments/{code}/reject', [TreasuryController::class, 'rejectReplenishment'])->name('finance.treasury.replenishments.reject');
    Route::post('treasury/replenishments/{code}/pay', [TreasuryController::class, 'payReplenishment'])->name('finance.treasury.replenishments.pay');
});
