<?php

declare(strict_types=1);

use App\Domain\Platform\Http\Controllers\MobileAppVersionController;
use Illuminate\Support\Facades\Route;

Route::name('operaciones.')->controller(MobileAppVersionController::class)->group(function (): void {
    Route::get('settings/mobile-app', 'show')->name('settings.mobile-app.show');
    Route::put('settings/mobile-app', 'update')->name('settings.mobile-app.update');
});
