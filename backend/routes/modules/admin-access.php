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

    Route::middleware('permission:admin.settings.manage')->group(function (): void {
        Route::get('integrations', [IntegrationController::class, 'index'])->name('integrations.index');
        Route::patch('integrations/{code}', [IntegrationController::class, 'configure'])->name('integrations.configure');
        Route::post('integrations/{code}/test', [IntegrationController::class, 'test'])->name('integrations.test');
        Route::post('jobs/{code}/{mode}', [IntegrationController::class, 'job'])->whereIn('mode', ['pause', 'resume'])->name('jobs.status');
        Route::post('integration-errors/{code}/retry', [IntegrationController::class, 'retryError'])->name('integration-errors.retry');
        Route::post('integration-errors/{code}/resolve', [IntegrationController::class, 'resolveError'])->name('integration-errors.resolve');
    });

    Route::middleware('permission:admin.audit.view')->group(function (): void {
        Route::get('audit-events', [AuditController::class, 'index'])->name('audit.index');
        Route::get('audit-events/{code}', [AuditController::class, 'show'])->whereNumber('code')->name('audit.show');
    });
});
