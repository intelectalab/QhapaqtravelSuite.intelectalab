<?php

declare(strict_types=1);

use App\Domain\Finance\Http\Controllers\PeriodCloseController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:finance.invoicing')->group(function (): void {
    Route::get('finance/period-closes/{period}', [PeriodCloseController::class, 'show'])->where('period', '\d{4}-\d{2}')->name('finance.period-closes.show');
    Route::put('finance/period-closes/{period}/checks/{check}', [PeriodCloseController::class, 'check'])->where('period', '\d{4}-\d{2}')->name('finance.period-closes.checks.update');
    Route::delete('finance/period-closes/{period}/checks/{check}', [PeriodCloseController::class, 'uncheck'])->where('period', '\d{4}-\d{2}')->name('finance.period-closes.checks.destroy');
    Route::post('finance/period-closes/{period}/close', [PeriodCloseController::class, 'close'])->where('period', '\d{4}-\d{2}')->name('finance.period-closes.close');
});
