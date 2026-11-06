<?php

declare(strict_types=1);

use App\Domain\Operations\Http\Controllers\VoucherController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:operations.view')->prefix('ops')->group(function (): void {
    Route::get('vouchers', [VoucherController::class, 'index'])->name('ops.vouchers.index');

    Route::middleware('permission:operations.vouchers')->group(function (): void {
        Route::post('vouchers', [VoucherController::class, 'store'])->name('ops.vouchers.store');
        Route::post('vouchers/{code}/versions', [VoucherController::class, 'version'])->name('ops.vouchers.versions');
        Route::post('vouchers/{code}/redeem', [VoucherController::class, 'redeem'])->name('ops.vouchers.redeem');
        Route::post('vouchers/{code}/void', [VoucherController::class, 'void'])->name('ops.vouchers.void');
    });
});
