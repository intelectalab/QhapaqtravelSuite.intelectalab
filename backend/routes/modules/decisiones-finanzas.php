<?php

declare(strict_types=1);

use App\Domain\Finance\Http\Controllers\FinanceProvidersController;
use Illuminate\Support\Facades\Route;

Route::name('finanzas.')->controller(FinanceProvidersController::class)->group(function (): void {
    Route::put('finance/fx-provider', 'selectFx')->middleware('permission:admin.settings.manage')->name('fx-provider.select');
    Route::get('finance/ose', 'ose')->middleware('permission:finance.invoicing|admin.settings.manage')->name('ose.show');
    Route::put('finance/ose', 'selectOse')->middleware('permission:admin.settings.manage')->name('ose.select');
});
