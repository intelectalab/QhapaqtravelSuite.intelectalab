<?php

declare(strict_types=1);

use App\Domain\Operations\Http\Controllers\IncidentController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:operations.view')->prefix('ops')->group(function (): void {
    Route::get('incidents', [IncidentController::class, 'index'])->name('ops.incidents.index');
    Route::get('incidents/{code}', [IncidentController::class, 'show'])->name('ops.incidents.show');

    Route::middleware('permission:operations.incidents')->group(function (): void {
        Route::post('incidents', [IncidentController::class, 'store'])->name('ops.incidents.store');
        Route::patch('incidents/{code}', [IncidentController::class, 'update'])->name('ops.incidents.update');
        Route::post('incidents/{code}/take', [IncidentController::class, 'take'])->name('ops.incidents.take');
        Route::post('incidents/{code}/resolve', [IncidentController::class, 'resolve'])->name('ops.incidents.resolve');
        Route::post('incidents/{code}/close', [IncidentController::class, 'close'])->name('ops.incidents.close');
        Route::post('incidents/{code}/reopen', [IncidentController::class, 'reopen'])->name('ops.incidents.reopen');
        Route::post('incidents/{code}/comments', [IncidentController::class, 'comment'])->name('ops.incidents.comments');
    });
});
