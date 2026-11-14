<?php

declare(strict_types=1);

use App\Domain\Platform\Http\Controllers\WhatsappAppSettingsController;
use Illuminate\Support\Facades\Route;

Route::middleware('platform.user:verified,admin.tenant.manage')->controller(WhatsappAppSettingsController::class)->name('decisiones-whatsapp.')->group(function (): void {
    Route::get('integrations/whatsapp', 'show')->name('integrations.whatsapp.show');
    Route::put('integrations/whatsapp', 'update')->name('integrations.whatsapp.update');
    Route::post('integrations/whatsapp/test', 'test')->middleware('throttle:6,1')->name('integrations.whatsapp.test');
});
