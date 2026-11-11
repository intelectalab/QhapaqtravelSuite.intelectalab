<?php

declare(strict_types=1);

use App\Domain\Finance\Http\Controllers\ReceivableController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:finance.receivables')->group(function (): void {
    Route::get('finance/receivables', [ReceivableController::class, 'index'])->name('finance.receivables.index');
    Route::post('finance/payments', [ReceivableController::class, 'registerPayment'])->middleware('permission:finance.payments.register')->name('finance.receivables.payments.store');
    Route::post('finance/receivables/advances', [ReceivableController::class, 'advance'])->middleware('permission:finance.payments.register')->name('finance.receivables.advances.store');
    Route::post('finance/receivables/{code}/reminders', [ReceivableController::class, 'remind'])->middleware('permission:finance.payments.register')->name('finance.receivables.reminders.store');
    Route::post('finance/receivables/{code}/cancel', [ReceivableController::class, 'cancel'])->middleware('permission:finance.payments.register')->name('finance.receivables.cancel');
});
