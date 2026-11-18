<?php

declare(strict_types=1);

use App\Domain\Admin\Http\Controllers\AgencyIntegrationsController;
use Illuminate\Support\Facades\Route;

Route::name('integraciones.')->controller(AgencyIntegrationsController::class)->group(function (): void {
    Route::get('integrations/readiness', 'readiness')->name('readiness');
    Route::get('settings/outgoing-mail', 'mail')->middleware('permission:admin.settings.manage')->name('mail.show');
    Route::put('settings/outgoing-mail', 'connectMail')->middleware(['permission:admin.settings.manage', 'throttle:10,1'])->name('mail.connect');
    Route::delete('settings/outgoing-mail', 'disconnectMail')->middleware('permission:admin.settings.manage')->name('mail.disconnect');
});
