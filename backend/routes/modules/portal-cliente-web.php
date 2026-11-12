<?php

declare(strict_types=1);

use App\Domain\Portal\Http\Controllers\CustomerPortalController;
use Illuminate\Support\Facades\Route;

Route::prefix('portal/client')->name('portal.customer.')->controller(CustomerPortalController::class)->group(function (): void {
    Route::get('reservations/{code}/web-summary', 'webSummary')->name('reservations.web-summary');
    Route::put('reservations/{code}/companions', 'companions')->name('reservations.companions');
});
