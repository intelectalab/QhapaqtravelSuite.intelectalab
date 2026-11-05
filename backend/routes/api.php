<?php

declare(strict_types=1);

use App\Domain\Booking\Http\Controllers\ReservationController;
use App\Domain\Catalog\Http\Controllers\ProductController;
use App\Domain\Crm\Http\Controllers\ActivityController;
use App\Domain\Crm\Http\Controllers\ClientController;
use App\Domain\Crm\Http\Controllers\LeadController;
use App\Domain\Crm\Http\Controllers\OpportunityController;
use App\Domain\Iam\Http\Controllers\SessionController;
use App\Domain\Platform\Http\Controllers\PlatformController;
use App\Domain\Reports\Http\Controllers\DashboardController;
use App\Domain\Shared\Http\Controllers\HealthController;
use Illuminate\Support\Facades\Route;

Route::get('health', HealthController::class)->name('health');

Route::post('auth/login', [SessionController::class, 'login'])->middleware('throttle:login')->name('auth.login');

Route::middleware(['auth:sanctum', 'tenant', 'tenant.db', 'tenant.active', 'permissions.team'])->group(function (): void {
    Route::post('auth/mfa/verify', [SessionController::class, 'verifyMfa'])->middleware(['ability:mfa:verify', 'throttle:login'])->name('auth.mfa.verify');
    Route::post('auth/logout', [SessionController::class, 'logout'])->name('auth.logout');
    Route::post('me/mfa/enroll', [SessionController::class, 'enrollMfa'])->middleware(['ability:mfa:verify', 'throttle:login'])->name('me.mfa.enroll');
    Route::post('me/mfa/confirm', [SessionController::class, 'confirmMfa'])->middleware(['ability:mfa:verify', 'throttle:login'])->name('me.mfa.confirm');

    Route::middleware('mfa')->group(function (): void {
        Route::get('me', [SessionController::class, 'me'])->name('me');
        Route::get('me/access', [SessionController::class, 'access'])->name('me.access');
        Route::get('me/counts', [DashboardController::class, 'counts'])->name('me.counts');
        Route::get('dashboard/home', [DashboardController::class, 'home'])->name('dashboard.home');

        Route::middleware('permission:crm.leads.view')->group(function (): void {
            Route::get('crm/catalogs', [LeadController::class, 'catalogs'])->name('crm.catalogs');
            Route::get('crm/leads', [LeadController::class, 'index'])->name('crm.leads.index');
            Route::get('crm/leads/{code}', [LeadController::class, 'show'])->name('crm.leads.show');

            Route::middleware('permission:crm.leads.manage')->group(function (): void {
                Route::post('crm/leads', [LeadController::class, 'store'])->name('crm.leads.store');
                Route::post('crm/leads/{code}/take', [LeadController::class, 'take'])->name('crm.leads.take');
                Route::post('crm/leads/{code}/status', [LeadController::class, 'status'])->name('crm.leads.status');
                Route::post('crm/leads/{code}/qualify', [LeadController::class, 'qualify'])->name('crm.leads.qualify');
                Route::post('crm/leads/{code}/discard', [LeadController::class, 'discard'])->name('crm.leads.discard');
                Route::post('crm/leads/{code}/convert', [LeadController::class, 'convert'])->middleware('permission:crm.opportunities.manage')->name('crm.leads.convert');
            });
        });

        Route::middleware('permission:reservations.view')->group(function (): void {
            Route::get('reservations', [ReservationController::class, 'index'])->name('reservations.index');
            Route::get('reservations/{code}', [ReservationController::class, 'show'])->name('reservations.show');
        });

        Route::middleware('permission:catalog.products.view')->group(function (): void {
            Route::get('catalog/products', [ProductController::class, 'index'])->name('catalog.products.index');
            Route::get('catalog/products/{code}', [ProductController::class, 'show'])->name('catalog.products.show');
        });

        Route::middleware('permission:crm.activities.manage')->group(function (): void {
            Route::get('crm/activities', [ActivityController::class, 'index'])->name('crm.activities.index');
            Route::get('crm/activities/related-options', [ActivityController::class, 'options'])->name('crm.activities.options');
            Route::post('crm/activities', [ActivityController::class, 'store'])->name('crm.activities.store');
            Route::post('crm/activities/{code}/complete', [ActivityController::class, 'complete'])->name('crm.activities.complete');
            Route::post('crm/activities/{code}/reschedule', [ActivityController::class, 'reschedule'])->name('crm.activities.reschedule');
        });

        Route::middleware('permission:crm.opportunities.manage')->group(function (): void {
            Route::get('crm/opportunities', [OpportunityController::class, 'index'])->name('crm.opportunities.index');
            Route::get('crm/opportunities/{code}', [OpportunityController::class, 'show'])->name('crm.opportunities.show');
            Route::post('crm/opportunities/{code}/stage', [OpportunityController::class, 'stage'])->name('crm.opportunities.stage');
        });

        Route::middleware('permission:crm.clients.manage|finance.receivables')->group(function (): void {
            Route::get('crm/clients', [ClientController::class, 'index'])->name('crm.clients.index');
            Route::get('crm/clients/form-options', [ClientController::class, 'formOptions'])->name('crm.clients.options');
            Route::get('crm/clients/{code}', [ClientController::class, 'show'])->name('crm.clients.show');

            Route::middleware('permission:crm.clients.manage')->group(function (): void {
                Route::post('crm/clients', [ClientController::class, 'store'])->name('crm.clients.store');
                Route::patch('crm/clients/{code}', [ClientController::class, 'update'])->name('crm.clients.update');
                Route::post('crm/clients/{code}/archive', [ClientController::class, 'archive'])->name('crm.clients.archive');
            });
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
            Route::put('plans/{code}', [PlatformController::class, 'updatePlan'])->name('plans.update');
        });
    });
});
