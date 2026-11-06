<?php

declare(strict_types=1);

use App\Domain\Reports\Http\Controllers\KpiController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:reports.view')->group(function (): void {
    Route::get('reports/kpis', [KpiController::class, 'kpis'])->name('reports.kpis');
    Route::get('reports/process-map', [KpiController::class, 'flow'])->name('reports.process-map');
});
