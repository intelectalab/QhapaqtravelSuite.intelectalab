<?php

declare(strict_types=1);

use App\Domain\Platform\Http\Controllers\PlatformFinanceIntegrationsController;
use Illuminate\Support\Facades\Route;

Route::middleware('platform.user:verified,admin.tenant.manage')->name('finanzas.')->controller(PlatformFinanceIntegrationsController::class)->group(function (): void {
    Route::get('fx-providers', 'fxProviders')->name('fx-providers.index');
    Route::post('fx-providers', 'storeFxProvider')->name('fx-providers.store');
    Route::patch('fx-providers/{code}', 'updateFxProvider')->name('fx-providers.update');
    Route::delete('fx-providers/{code}', 'destroyFxProvider')->name('fx-providers.destroy');
    Route::post('fx-providers/{code}/test', 'testFxProvider')->middleware('throttle:12,1')->name('fx-providers.test');
    Route::get('ose-providers', 'oseProviders')->name('ose-providers.index');
    Route::post('ose-providers', 'storeOseProvider')->name('ose-providers.store');
    Route::patch('ose-providers/{code}', 'updateOseProvider')->name('ose-providers.update');
    Route::delete('ose-providers/{code}', 'destroyOseProvider')->name('ose-providers.destroy');
    Route::post('ose-providers/{code}/webhook-secret', 'generateOseWebhookSecret')->middleware('throttle:6,1')->name('ose-providers.webhook-secret');
    Route::get('tenants/{id}/ose', 'tenantOse')->name('tenants.ose.show');
    Route::put('tenants/{id}/ose/credentials', 'saveTenantOseCredentials')->name('tenants.ose.credentials');
    Route::delete('tenants/{id}/ose/credentials', 'clearTenantOseCredentials')->name('tenants.ose.credentials.destroy');
    Route::post('tenants/{id}/ose/test', 'testTenantOse')->middleware('throttle:12,1')->name('tenants.ose.test');
});
