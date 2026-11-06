<?php

declare(strict_types=1);

use App\Domain\Admin\Http\Controllers\ApiAccessController;
use App\Domain\Admin\Http\Controllers\AuditController;
use App\Domain\Admin\Http\Controllers\IntegrationController;
use App\Domain\Admin\Http\Controllers\SubscriptionController;
use Illuminate\Support\Facades\Route;

Route::prefix('admin')->name('admin.')->group(function (): void {
    Route::middleware('permission:admin.billing.manage')->group(function (): void {
        Route::get('subscription', [SubscriptionController::class, 'index'])->name('subscription.index');
        Route::patch('subscription/billing', [SubscriptionController::class, 'billing'])->name('subscription.billing');
    });

    Route::middleware('permission:admin.api.manage')->group(function (): void {
        Route::get('api', [ApiAccessController::class, 'index'])->name('api.index');
        Route::post('api/keys', [ApiAccessController::class, 'storeKey'])->name('api.keys.store');
        Route::post('api/keys/{code}/revoke', [ApiAccessController::class, 'revokeKey'])->name('api.keys.revoke');
        Route::post('api/webhooks', [ApiAccessController::class, 'storeWebhook'])->name('api.webhooks.store');
        Route::patch('api/webhooks/{code}', [ApiAccessController::class, 'updateWebhook'])->name('api.webhooks.update');
        Route::delete('api/webhooks/{code}', [ApiAccessController::class, 'destroyWebhook'])->name('api.webhooks.destroy');
        Route::post('api/webhooks/{code}/{mode}', [ApiAccessController::class, 'webhookStatus'])->whereIn('mode', ['pause', 'resume'])->name('api.webhooks.status');
    });
});

Route::middleware('permission:admin.settings.manage')->group(function (): void {
    Route::get('integrations', [IntegrationController::class, 'index'])->name('integrations.index');
    Route::patch('integrations/{id}/config', [IntegrationController::class, 'configure'])->name('integrations.config');
    Route::post('integrations/{id}/test', [IntegrationController::class, 'test'])->name('integrations.test');
    Route::get('jobs', [IntegrationController::class, 'jobs'])->name('jobs.index');
    Route::post('jobs/{id}/run', [IntegrationController::class, 'run'])->name('jobs.run');
    Route::post('jobs/{id}/pause', [IntegrationController::class, 'pause'])->name('jobs.pause');
    Route::post('jobs/{id}/resume', [IntegrationController::class, 'resume'])->name('jobs.resume');
});

Route::middleware('permission:admin.settings.manage|reports.export')->group(function (): void {
    Route::delete('jobs/{id}', [IntegrationController::class, 'destroyJob'])->name('jobs.destroy');
    Route::get('integration-errors', [IntegrationController::class, 'errors'])->name('integration-errors.index');
    Route::post('integration-errors/{id}/retry', [IntegrationController::class, 'retryError'])->name('integration-errors.retry');
    Route::post('integration-errors/{id}/resolve', [IntegrationController::class, 'resolveError'])->name('integration-errors.resolve');
});

Route::get('audit-events', [AuditController::class, 'index'])->middleware('permission:admin.audit.view|admin.roles.manage')->name('audit-events.index');

Route::middleware('permission:admin.audit.view')->group(function (): void {
    Route::post('audit-events/exports', [AuditController::class, 'export'])->middleware('throttle:exports')->name('audit-events.exports');
    Route::get('audit-events/{id}', [AuditController::class, 'show'])->name('audit-events.show');
});
