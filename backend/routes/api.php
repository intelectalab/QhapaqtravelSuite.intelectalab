<?php

declare(strict_types=1);

use App\Domain\Crm\Http\Controllers\ClientController;
use App\Domain\Iam\Http\Controllers\SessionController;
use App\Domain\Platform\Http\Controllers\PlatformController;
use App\Domain\Shared\Http\Controllers\HealthController;
use Illuminate\Support\Facades\Route;

Route::get('health', HealthController::class)->name('health');

Route::post('auth/login', [SessionController::class, 'login'])->middleware('throttle:login')->name('auth.login');

Route::middleware(['auth:sanctum', 'tenant', 'tenant.db', 'tenant.active', 'permissions.team'])->group(function (): void {
    Route::post('auth/mfa/verify', [SessionController::class, 'verifyMfa'])->middleware(['ability:mfa:verify', 'throttle:login'])->name('auth.mfa.verify');
    Route::post('auth/logout', [SessionController::class, 'logout'])->name('auth.logout');

    Route::middleware('mfa')->group(function (): void {
        Route::get('me', [SessionController::class, 'me'])->name('me');

        Route::middleware('permission:crm.clients.manage|finance.receivables')->group(function (): void {
            Route::get('crm/clients', [ClientController::class, 'index'])->name('crm.clients.index');
            Route::get('crm/clients/{code}', [ClientController::class, 'show'])->name('crm.clients.show');
        });
    });
});

Route::prefix('platform')->name('platform.')->group(function (): void {
    Route::middleware('auth:sanctum')->group(function (): void {
        Route::post('auth/mfa/verify', [PlatformController::class, 'verifyMfa'])->middleware(['platform.user:pending', 'ability:mfa:verify', 'throttle:login'])->name('auth.mfa.verify');
        Route::post('auth/logout', [PlatformController::class, 'logout'])->middleware('platform.user:pending')->name('auth.logout');

        Route::middleware('platform.user')->group(function (): void {
            Route::get('me', [PlatformController::class, 'me'])->name('me');
            Route::get('tenants', [PlatformController::class, 'tenants'])->name('tenants.index');
            Route::get('tenants/{id}', [PlatformController::class, 'tenant'])->name('tenants.show');
            Route::post('tenants/{id}/suspend', [PlatformController::class, 'suspend'])->name('tenants.suspend');
            Route::post('tenants/{id}/reactivate', [PlatformController::class, 'reactivate'])->name('tenants.reactivate');
            Route::get('plans', [PlatformController::class, 'plans'])->name('plans.index');
            Route::get('plans/{code}', [PlatformController::class, 'plan'])->name('plans.show');
        });
    });
});
