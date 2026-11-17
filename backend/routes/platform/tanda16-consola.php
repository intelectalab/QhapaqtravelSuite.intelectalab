<?php

declare(strict_types=1);

use App\Domain\Platform\Http\Controllers\PayloadWebhookSettingsController;
use Illuminate\Support\Facades\Route;

Route::middleware('platform.user:verified,admin.tenant.manage')->controller(PayloadWebhookSettingsController::class)->name('tanda16-consola.')->group(function (): void {
    Route::get('integrations/payload', 'show')->name('integrations.payload.show');
    Route::put('integrations/payload', 'update')->name('integrations.payload.update');
    Route::post('integrations/payload/secret', 'generate')->middleware('throttle:6,1')->name('integrations.payload.secret');
});
