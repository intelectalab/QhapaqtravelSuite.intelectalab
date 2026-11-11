<?php

declare(strict_types=1);

use App\Domain\Finance\Http\Controllers\PaymentController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:finance.receivables|finance.payments.register')->group(function (): void {
    Route::get('finance/payments', [PaymentController::class, 'index'])->name('finance.payments.index');
    Route::post('finance/payments/{code}/confirm', [PaymentController::class, 'confirm'])->middleware('permission:finance.payments.register')->name('finance.payments.confirm');
    Route::post('finance/payments/{code}/reject', [PaymentController::class, 'reject'])->middleware('permission:finance.payments.register')->name('finance.payments.reject');
    Route::post('finance/payments/{code}/retry', [PaymentController::class, 'retry'])->middleware('permission:finance.payments.register')->name('finance.payments.retry');
    Route::post('finance/payments/{code}/revert', [PaymentController::class, 'revert'])->middleware('permission:finance.payments.revert')->name('finance.payments.revert');
});
