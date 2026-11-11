<?php

declare(strict_types=1);

use App\Domain\Marketing\Http\Controllers\AutomationController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:marketing.campaigns.manage')->group(function (): void {
    Route::get('marketing/automations', [AutomationController::class, 'index'])->name('marketing.automations.index');
    Route::put('marketing/automations/{code}', [AutomationController::class, 'update'])->middleware('if-match:mkt_automations,code,code')->name('marketing.automations.update');
    Route::post('marketing/automations/{code}/activate', [AutomationController::class, 'activate'])->middleware('if-match:mkt_automations,code,code')->name('marketing.automations.activate');
    Route::post('marketing/automations/{code}/pause', [AutomationController::class, 'pause'])->middleware('if-match:mkt_automations,code,code')->name('marketing.automations.pause');
    Route::post('marketing/automations/{code}/run', [AutomationController::class, 'run'])->middleware('idempotent')->name('marketing.automations.run');
});
