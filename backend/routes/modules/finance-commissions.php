<?php

declare(strict_types=1);

use App\Domain\Finance\Http\Controllers\CommissionController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:finance.commissions')->group(function (): void {
    Route::get('finance/commissions', [CommissionController::class, 'index'])->name('finance.commissions.index');
    Route::post('finance/commissions/calculate', [CommissionController::class, 'calculate'])->middleware('permission:finance.payments.register')->name('finance.commissions.calculate');
    Route::post('finance/commissions/{code}/approve', [CommissionController::class, 'approve'])->name('finance.commissions.approve');
    Route::post('finance/commissions/{code}/pay', [CommissionController::class, 'pay'])->middleware('permission:finance.payments.register')->name('finance.commissions.pay');
    Route::post('finance/commissions/{code}/annul', [CommissionController::class, 'annul'])->name('finance.commissions.annul');
});
