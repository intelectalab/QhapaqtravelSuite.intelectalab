<?php

declare(strict_types=1);

use App\Domain\Finance\Http\Controllers\FinanceDetailController;
use Illuminate\Support\Facades\Route;

Route::get('finance/receivables/{code}', [FinanceDetailController::class, 'receivable'])->middleware('permission:finance.receivables')->where('code', 'CXC-[0-9]+')->name('finance.receivables.show');
Route::get('finance/payments/{code}', [FinanceDetailController::class, 'payment'])->middleware('permission:finance.receivables|finance.payments.register')->where('code', 'PAG-[0-9]+')->name('finance.payments.show');
Route::get('finance/payables/{code}', [FinanceDetailController::class, 'payable'])->middleware('permission:finance.payables')->where('code', 'CXP-[0-9]+')->name('finance.payables.show');
Route::get('finance/commissions/{code}', [FinanceDetailController::class, 'commission'])->middleware('permission:finance.commissions')->where('code', 'COM-[0-9]+')->name('finance.commissions.show');
Route::get('finance/reservations/{code}/settlement', [FinanceDetailController::class, 'settlement'])->middleware('permission:finance.profitability')->name('finance.settlements.show');
Route::post('finance/reservations/{code}/settlement', [FinanceDetailController::class, 'closeSettlement'])->middleware('permission:finance.profitability')->name('finance.settlements.close');
