<?php

declare(strict_types=1);

use App\Domain\Finance\Http\Controllers\FxRateController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:admin.settings.manage|finance.treasury|finance.receivables')->group(function (): void {
    Route::get('finance/fx-rates', [FxRateController::class, 'index'])->name('finance.fx.index');
    Route::post('finance/fx-rates', [FxRateController::class, 'store'])->middleware('permission:admin.settings.manage|finance.treasury')->name('finance.fx.store');
});

Route::middleware('permission:admin.settings.manage|finance.treasury')->group(function (): void {
    Route::get('finance/currencies', [FxRateController::class, 'currencies'])->name('finance.currencies.index');
    Route::patch('finance/currencies/{code}', [FxRateController::class, 'updateCurrency'])->middleware('permission:admin.settings.manage')->name('finance.currencies.update');
    Route::patch('finance/fx-settings', [FxRateController::class, 'saveSettings'])->middleware('permission:admin.settings.manage')->name('finance.fx-settings.update');
});
