<?php

declare(strict_types=1);

use App\Domain\Admin\Http\Controllers\ApiAccessController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:admin.api.manage')->name('api.webhooks.')->group(function (): void {
    Route::post('integrations/webhooks/{code}/rotate-secret', [ApiAccessController::class, 'rotateSecret'])->name('rotate');
    Route::post('integrations/webhooks/{code}/ping', [ApiAccessController::class, 'ping'])->name('ping');
    Route::get('integrations/webhook-deliveries/{code}', [ApiAccessController::class, 'delivery'])->name('deliveries.show');
    Route::post('integrations/webhook-deliveries/{code}/redeliver', [ApiAccessController::class, 'redeliver'])->name('deliveries.redeliver');
});
