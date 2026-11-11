<?php

declare(strict_types=1);

use App\Domain\Reports\Http\Controllers\KpiController;
use App\Domain\Reports\Http\Controllers\ReportExportController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:reports.view')->group(function (): void {
    Route::get('reports/kpis', [KpiController::class, 'kpis'])->name('reports.kpis');
    Route::get('reports/process-map', [KpiController::class, 'flow'])->name('reports.process-map');
    Route::get('reports/exports', [ReportExportController::class, 'index'])->name('reports.exports.index');
    Route::post('reports/exports', [ReportExportController::class, 'store'])->middleware('throttle:exports')->name('reports.exports.store');
    Route::get('reports/exports/{id}/download', [ReportExportController::class, 'download'])->name('reports.exports.download');
    Route::post('reports/schedules', [ReportExportController::class, 'schedule'])->name('reports.schedules.store');
    Route::get('reports/{report}', [KpiController::class, 'report'])->where('report', 'comercial|cotizaciones|reservas|operaciones|finanzas|proveedores|clientes')->name('reports.show');
});
