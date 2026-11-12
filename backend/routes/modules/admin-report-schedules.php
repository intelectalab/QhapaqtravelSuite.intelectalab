<?php

declare(strict_types=1);

use App\Domain\Admin\Http\Controllers\IntegrationController;
use App\Domain\Reports\Http\Controllers\ReportExportController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:admin.settings.manage|reports.export')->group(function (): void {
    Route::patch('reports/schedules/{id}', [ReportExportController::class, 'updateSchedule'])->name('reports.schedules.update');
    Route::post('reports/schedules/{id}/pause', [IntegrationController::class, 'pauseSchedule'])->name('reports.schedules.pause');
    Route::post('reports/schedules/{id}/resume', [IntegrationController::class, 'resumeSchedule'])->name('reports.schedules.resume');
});
