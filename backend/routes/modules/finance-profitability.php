<?php

declare(strict_types=1);

use App\Domain\Finance\Http\Controllers\ProfitabilityController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:finance.profitability')->group(function (): void {
    Route::get('finance/profitability', [ProfitabilityController::class, 'index'])->name('finance.profitability.index');
});
