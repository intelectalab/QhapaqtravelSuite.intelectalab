<?php

declare(strict_types=1);

use App\Domain\Operations\Http\Controllers\SupplierResponseController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:operations.view')->prefix('ops')->group(function (): void {
    Route::get('supplier-responses', [SupplierResponseController::class, 'index'])->name('ops.supplier-responses.index');

    Route::middleware('permission:operations.assign')->group(function (): void {
        Route::post('supplier-responses/{id}/accept', [SupplierResponseController::class, 'accept'])->name('ops.supplier-responses.accept');
        Route::post('supplier-responses/{id}/reject', [SupplierResponseController::class, 'reject'])->name('ops.supplier-responses.reject');
    });
});
