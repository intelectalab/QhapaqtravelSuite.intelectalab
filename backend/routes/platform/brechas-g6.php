<?php

declare(strict_types=1);

use App\Domain\Platform\Http\Controllers\FiscalWebhookSettingsController;
use App\Domain\Platform\Http\Controllers\PlatformAuditExportController;
use Illuminate\Support\Facades\Route;

Route::name('brechas-g6.')->group(function (): void {
    Route::put('settings/fiscal-webhook', FiscalWebhookSettingsController::class)->name('settings.fiscal-webhook');
    Route::get('audit-events/export', PlatformAuditExportController::class)->middleware(['platform.user:verified,admin.audit.view', 'throttle:10,1'])->name('audit-events.export');
});
