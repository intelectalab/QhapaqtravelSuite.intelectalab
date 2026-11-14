<?php

declare(strict_types=1);

use App\Domain\Admin\Http\Controllers\BusinessHoursController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:admin.settings.manage')->name('base.')->group(function (): void {
    Route::get('settings/business-hours', [BusinessHoursController::class, 'show'])->name('settings.business-hours.show');
    Route::put('settings/business-hours', [BusinessHoursController::class, 'update'])->name('settings.business-hours.update');
});
