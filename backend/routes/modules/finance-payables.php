<?php

declare(strict_types=1);

use App\Domain\Finance\Http\Controllers\PayableController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:finance.payables')->group(function (): void {
    Route::get('finance/payables', [PayableController::class, 'index'])->name('finance.payables.index');
    Route::post('finance/payables', [PayableController::class, 'store'])->name('finance.payables.store');
    Route::patch('finance/payables/{code}', [PayableController::class, 'update'])->name('finance.payables.update');
    Route::post('finance/payables/{code}/approve', [PayableController::class, 'approve'])->name('finance.payables.approve');
    Route::post('finance/payables/{code}/payouts', [PayableController::class, 'pay'])->middleware('permission:finance.payments.register')->name('finance.payables.pay');
    Route::post('finance/payables/{code}/cancel', [PayableController::class, 'cancel'])->name('finance.payables.cancel');
});
