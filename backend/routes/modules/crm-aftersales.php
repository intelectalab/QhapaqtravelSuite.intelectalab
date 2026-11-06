<?php

declare(strict_types=1);

use App\Domain\Crm\Http\Controllers\AfterSalesController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:crm.clients.manage')->group(function (): void {
    Route::get('crm/after-sales', [AfterSalesController::class, 'index'])->name('crm.aftersales.index');
    Route::post('crm/surveys', [AfterSalesController::class, 'storeSurvey'])->name('crm.surveys.store');
    Route::patch('crm/surveys/{code}', [AfterSalesController::class, 'updateSurvey'])->name('crm.surveys.update');
    Route::post('crm/cases', [AfterSalesController::class, 'storeCase'])->name('crm.cases.store');
    Route::patch('crm/cases/{code}', [AfterSalesController::class, 'updateCase'])->name('crm.cases.update');
    Route::post('crm/cases/{code}/transition', [AfterSalesController::class, 'transitionCase'])->name('crm.cases.transition');
});
