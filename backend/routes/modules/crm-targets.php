<?php

declare(strict_types=1);

use App\Domain\Crm\Http\Controllers\SalesTargetController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:crm.targets.view|crm.targets.manage')->group(function (): void {
    Route::get('crm/sales-targets', [SalesTargetController::class, 'index'])->name('crm.targets.index');
    Route::get('crm/sales-targets/{code}', [SalesTargetController::class, 'show'])->where('code', '(?!ranking$)[^/]+')->name('crm.targets.show');

    Route::middleware('permission:crm.targets.manage')->group(function (): void {
        Route::post('crm/sales-targets', [SalesTargetController::class, 'store'])->name('crm.targets.store');
        Route::patch('crm/sales-targets/{code}', [SalesTargetController::class, 'update'])->name('crm.targets.update');
        Route::post('crm/sales-targets/{code}/activate', [SalesTargetController::class, 'activate'])->name('crm.targets.activate');
        Route::post('crm/sales-targets/{code}/void', [SalesTargetController::class, 'void'])->name('crm.targets.void');
        Route::post('crm/sales-targets/{code}/close', [SalesTargetController::class, 'close'])->name('crm.targets.close');
    });
});
