<?php

declare(strict_types=1);

use App\Domain\Finance\Http\Controllers\TreasuryController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:finance.treasury')->group(function (): void {
    Route::get('treasury/accounts', [TreasuryController::class, 'index'])->name('finance.treasury.index');
    Route::post('treasury/movements', [TreasuryController::class, 'store'])->name('finance.treasury.movements.store');
    Route::post('treasury/movements/{code}/void', [TreasuryController::class, 'void'])->name('finance.treasury.movements.void');
});
