<?php

declare(strict_types=1);

use App\Domain\Booking\Http\Controllers\ReservationController;
use App\Domain\Catalog\Actions\ProductWorkflow;
use App\Domain\Catalog\Http\Controllers\ProductController;
use App\Domain\Crm\Http\Controllers\ActivityController;
use App\Domain\Crm\Http\Controllers\ClientController;
use App\Domain\Crm\Http\Controllers\LeadController;
use App\Domain\Crm\Http\Controllers\OpportunityController;
use App\Domain\Iam\Http\Controllers\RoleController;
use App\Domain\Iam\Http\Controllers\SedeController;
use App\Domain\Iam\Http\Controllers\SessionController;
use App\Domain\Iam\Http\Controllers\UserController;
use App\Domain\Platform\Http\Controllers\PlatformController;
use App\Domain\Quotes\Http\Controllers\QuoteController;
use App\Domain\Reports\Http\Controllers\DashboardController;
use App\Domain\Shared\Http\Controllers\HealthController;
use Illuminate\Support\Facades\Route;

Route::get('health', HealthController::class)->name('health');

Route::prefix('public')->middleware('throttle:public')->name('public.')->group(function (): void {
    foreach (glob(__DIR__.'/public/*.php') ?: [] as $publicRoutes) {
        require $publicRoutes;
    }
});

Route::post('auth/login', [SessionController::class, 'login'])->middleware('throttle:login')->name('auth.login');
Route::get('auth/invitations/{token}', [SessionController::class, 'invitation'])->middleware('throttle:login')->name('auth.invitations.show');
Route::post('auth/invitations/{token}', [SessionController::class, 'acceptInvitation'])->middleware('throttle:login')->name('auth.invitations.accept');

Route::middleware(['auth:sanctum', 'tenant', 'tenant.db', 'tenant.active', 'permissions.team'])->group(function (): void {
    Route::post('auth/mfa/verify', [SessionController::class, 'verifyMfa'])->middleware(['ability:mfa:verify', 'throttle:login'])->name('auth.mfa.verify');
    Route::post('auth/logout', [SessionController::class, 'logout'])->name('auth.logout');
    Route::post('me/mfa/enroll', [SessionController::class, 'enrollMfa'])->middleware(['ability:mfa:verify', 'throttle:login'])->name('me.mfa.enroll');
    Route::post('me/mfa/confirm', [SessionController::class, 'confirmMfa'])->middleware(['ability:mfa:verify', 'throttle:login'])->name('me.mfa.confirm');

    Route::middleware(['mfa', 'experience'])->group(function (): void {
        Route::get('me', [SessionController::class, 'me'])->name('me');
        Route::get('me/access', [SessionController::class, 'access'])->name('me.access');
        Route::get('me/counts', [DashboardController::class, 'counts'])->name('me.counts');
        Route::get('dashboard/home', [DashboardController::class, 'home'])->name('dashboard.home');

        Route::middleware('permission:crm.leads.view')->group(function (): void {
            Route::get('crm/catalogs', [LeadController::class, 'catalogs'])->name('crm.catalogs');
            Route::get('crm/leads', [LeadController::class, 'index'])->name('crm.leads.index');
            Route::get('crm/advisors', [LeadController::class, 'advisors'])->name('crm.advisors');
            Route::get('crm/leads/{code}', [LeadController::class, 'show'])->name('crm.leads.show');

            Route::middleware('permission:crm.leads.manage')->group(function (): void {
                Route::post('crm/leads', [LeadController::class, 'store'])->name('crm.leads.store');
                Route::post('crm/leads/{code}/take', [LeadController::class, 'take'])->name('crm.leads.take');
                Route::patch('crm/leads/{code}', [LeadController::class, 'update'])->name('crm.leads.update');
                Route::post('crm/leads/{code}/assign', [LeadController::class, 'assign'])->middleware('permission:crm.records.reassign')->name('crm.leads.assign');
                Route::post('crm/leads/{code}/status', [LeadController::class, 'status'])->name('crm.leads.status');
                Route::post('crm/leads/{code}/qualify', [LeadController::class, 'qualify'])->name('crm.leads.qualify');
                Route::post('crm/leads/{code}/discard', [LeadController::class, 'discard'])->name('crm.leads.discard');
                Route::post('crm/leads/{code}/convert', [LeadController::class, 'convert'])->middleware('permission:crm.opportunities.manage')->name('crm.leads.convert');
            });
        });

        Route::middleware('permission:reservations.view')->group(function (): void {
            Route::get('reservations', [ReservationController::class, 'index'])->name('reservations.index');
            Route::get('reservations/{code}', [ReservationController::class, 'show'])->name('reservations.show');
            Route::patch('reservations/{code}', [ReservationController::class, 'update'])->middleware('permission:reservations.modify')->name('reservations.update');
            Route::post('reservations/{code}/passengers', [ReservationController::class, 'savePassenger'])->middleware('permission:reservations.modify')->name('reservations.passengers.store');
            Route::patch('reservations/{code}/passengers/{passenger}', [ReservationController::class, 'savePassenger'])->middleware('permission:reservations.modify')->name('reservations.passengers.update');
            Route::delete('reservations/{code}/passengers/{passenger}', [ReservationController::class, 'deletePassenger'])->middleware('permission:reservations.modify')->name('reservations.passengers.destroy');
            Route::get('reservations/{code}/changes/options', [ReservationController::class, 'changeOptions'])->middleware('permission:reservations.modify')->name('reservations.changes.options');
            Route::post('reservations/{code}/changes/preview', [ReservationController::class, 'changePreview'])->middleware('permission:reservations.modify')->name('reservations.changes.preview');
            Route::post('reservations/{code}/changes', [ReservationController::class, 'requestChange'])->middleware('permission:reservations.modify')->name('reservations.changes.store');
            Route::post('reservations/{code}/changes/{change}/approve', [ReservationController::class, 'approveChange'])->middleware('permission:quotes.approve_internal')->name('reservations.changes.approve');
            Route::post('reservations/{code}/changes/{change}/reject', [ReservationController::class, 'rejectChange'])->middleware('permission:quotes.approve_internal')->name('reservations.changes.reject');
            Route::post('reservations/{code}/reschedule/preview', [ReservationController::class, 'reschedulePreview'])->middleware('permission:reservations.modify')->name('reservations.reschedule.preview');
            Route::post('reservations/{code}/reschedule', [ReservationController::class, 'reschedule'])->middleware('permission:reservations.modify')->name('reservations.reschedule');
            Route::get('reservations/{code}/cancellation', [ReservationController::class, 'cancellation'])->middleware('permission:reservations.cancel|reservations.create')->name('reservations.cancellation');
            Route::post('reservations/{code}/cancel', [ReservationController::class, 'cancel'])->middleware('permission:reservations.cancel')->name('reservations.cancel');
            Route::post('reservations/{code}/cancel-requests', [ReservationController::class, 'requestCancel'])->middleware('permission:reservations.create')->name('reservations.cancel-requests.store');
            Route::post('reservations/{code}/cancel-requests/reject', [ReservationController::class, 'rejectCancelRequest'])->middleware('permission:reservations.cancel')->name('reservations.cancel-requests.reject');
        });

        Route::middleware('permission:catalog.products.view')->group(function (): void {
            Route::get('catalog/products', [ProductController::class, 'index'])->name('catalog.products.index');
            Route::get('catalog/products/form-options', [ProductController::class, 'formOptions'])->name('catalog.products.options');
            Route::get('catalog/products/{code}', [ProductController::class, 'show'])->name('catalog.products.show');
            Route::get('catalog/products/{code}/activation-checklist', [ProductController::class, 'checklist'])->name('catalog.products.checklist');
            Route::post('catalog/products', [ProductController::class, 'store'])->middleware('permission:catalog.products.create')->name('catalog.products.store');
            Route::patch('catalog/products/{code}', [ProductController::class, 'update'])->middleware('permission:catalog.products.update')->name('catalog.products.update');
            Route::delete('catalog/products/{code}', [ProductController::class, 'destroy'])->middleware('permission:catalog.products.activate')->name('catalog.products.destroy');
            foreach (array_keys(ProductWorkflow::TRANSITIONS) as $action) {
                Route::post("catalog/products/{code}/{$action}", [ProductController::class, 'transition'])
                    ->defaults('action', $action)
                    ->middleware('permission:catalog.products.update|catalog.products.activate')->name("catalog.products.{$action}");
            }
        });

        Route::middleware('permission:crm.activities.manage')->group(function (): void {
            Route::get('crm/activities', [ActivityController::class, 'index'])->name('crm.activities.index');
            Route::get('crm/activities/related-options', [ActivityController::class, 'options'])->name('crm.activities.options');
            Route::post('crm/activities', [ActivityController::class, 'store'])->name('crm.activities.store');
            Route::post('crm/activities/{code}/complete', [ActivityController::class, 'complete'])->name('crm.activities.complete');
            Route::post('crm/activities/{code}/reschedule', [ActivityController::class, 'reschedule'])->name('crm.activities.reschedule');
            Route::patch('crm/activities/{code}', [ActivityController::class, 'update'])->name('crm.activities.update');
            Route::delete('crm/activities/{code}', [ActivityController::class, 'destroy'])->name('crm.activities.destroy');
        });

        Route::middleware('permission:crm.opportunities.manage')->group(function (): void {
            Route::get('crm/opportunities', [OpportunityController::class, 'index'])->name('crm.opportunities.index');
            Route::get('crm/opportunities/form-options', [OpportunityController::class, 'formOptions'])->name('crm.opportunities.options');
            Route::post('crm/opportunities', [OpportunityController::class, 'store'])->name('crm.opportunities.store');
            Route::get('crm/opportunities/{code}', [OpportunityController::class, 'show'])->name('crm.opportunities.show');
            Route::patch('crm/opportunities/{code}', [OpportunityController::class, 'update'])->name('crm.opportunities.update');
            Route::post('crm/opportunities/{code}/stage', [OpportunityController::class, 'stage'])->name('crm.opportunities.stage');
        });

        Route::middleware('permission:quotes.view')->group(function (): void {
            Route::get('quotes', [QuoteController::class, 'index'])->name('quotes.index');
            Route::get('quotes/form-options', [QuoteController::class, 'formOptions'])->middleware('permission:quotes.create')->name('quotes.options');
            Route::post('quotes/pricing/preview', [QuoteController::class, 'preview'])->middleware('permission:quotes.create')->name('quotes.preview');
            Route::post('quotes', [QuoteController::class, 'store'])->middleware('permission:quotes.create')->name('quotes.store');
            Route::get('quotes/{code}', [QuoteController::class, 'show'])->name('quotes.show');
            Route::put('quotes/{code}', [QuoteController::class, 'update'])->middleware('permission:quotes.create')->name('quotes.update');
            Route::post('quotes/{code}/versions', [QuoteController::class, 'newVersion'])->middleware('permission:quotes.create')->name('quotes.versions.store');
            Route::post('quotes/{code}/internal-approval-requests', [QuoteController::class, 'requestInternal'])->middleware('permission:quotes.create|quotes.send')->name('quotes.internal.request');
            Route::post('quotes/{code}/internal-approval', [QuoteController::class, 'decideInternal'])->middleware('permission:quotes.approve_internal')->name('quotes.internal.decide');
            Route::post('quotes/{code}/send', [QuoteController::class, 'send'])->middleware('permission:quotes.send')->name('quotes.send');
            Route::post('quotes/{code}/negotiations', [QuoteController::class, 'negotiate'])->middleware('permission:quotes.send')->name('quotes.negotiations');
            Route::post('quotes/{code}/approve', [QuoteController::class, 'approve'])->middleware('permission:reservations.create')->name('quotes.approve');
            Route::delete('quotes/{code}', [QuoteController::class, 'destroy'])->middleware('permission:quotes.create')->name('quotes.destroy');
            Route::get('quotes/{code}/conversion', [ReservationController::class, 'conversion'])->middleware('permission:reservations.create')->name('quotes.conversion');
            Route::post('quotes/{code}/convert', [ReservationController::class, 'convert'])->middleware('permission:reservations.create')->name('quotes.convert');
            Route::post('quotes/{code}/reject', [QuoteController::class, 'reject'])->middleware('permission:quotes.send')->name('quotes.reject');
        });

        Route::middleware('permission:admin.roles.manage')->group(function (): void {
            Route::get('iam/roles', [RoleController::class, 'index'])->name('iam.roles.index');
            Route::post('iam/roles', [RoleController::class, 'store'])->name('iam.roles.store');
            Route::patch('iam/roles/{code}', [RoleController::class, 'update'])->name('iam.roles.update');
            Route::delete('iam/roles/{code}', [RoleController::class, 'destroy'])->name('iam.roles.destroy');
            Route::post('iam/roles/{code}/permissions/bulk', [RoleController::class, 'permissions'])->name('iam.roles.permissions');
        });

        Route::middleware('permission:admin.users.manage')->group(function (): void {
            Route::get('iam/users', [UserController::class, 'index'])->name('iam.users.index');
            Route::post('iam/users', [UserController::class, 'store'])->name('iam.users.store');
            Route::patch('iam/users/{code}', [UserController::class, 'update'])->name('iam.users.update');
            Route::post('iam/users/{code}/deactivate', [UserController::class, 'deactivate'])->name('iam.users.deactivate');
            Route::post('iam/users/{code}/activate', [UserController::class, 'activate'])->name('iam.users.activate');
            Route::post('iam/users/{code}/reset-mfa', [UserController::class, 'resetMfa'])->name('iam.users.reset-mfa');
            Route::post('iam/users/{code}/resend-invitation', [UserController::class, 'resendInvitation'])->name('iam.users.resend-invitation');
            Route::get('iam/sedes', [SedeController::class, 'index'])->name('iam.sedes.index');
            Route::post('iam/sedes', [SedeController::class, 'store'])->name('iam.sedes.store');
            Route::patch('iam/sedes/{code}', [SedeController::class, 'update'])->name('iam.sedes.update');
            Route::delete('iam/sedes/{code}', [SedeController::class, 'destroy'])->name('iam.sedes.destroy');
            Route::post('iam/sedes/{code}/activate', [SedeController::class, 'activate'])->name('iam.sedes.activate');
            Route::post('iam/sedes/{code}/deactivate', [SedeController::class, 'deactivate'])->name('iam.sedes.deactivate');
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

        foreach (glob(__DIR__.'/modules/*.php') ?: [] as $moduleRoutes) {
            require $moduleRoutes;
        }
    });
});

Route::prefix('platform')->name('platform.')->group(function (): void {
    Route::middleware('auth:sanctum')->group(function (): void {
        Route::post('auth/mfa/verify', [PlatformController::class, 'verifyMfa'])->middleware(['platform.user:pending', 'ability:mfa:verify', 'throttle:login'])->name('auth.mfa.verify');
        Route::post('auth/logout', [PlatformController::class, 'logout'])->middleware('platform.user:pending')->name('auth.logout');

        Route::middleware('platform.user')->group(function (): void {
            Route::get('me', [PlatformController::class, 'me'])->name('me');
            Route::middleware('platform.user:verified,admin.tenant.manage')->group(function (): void {
                Route::get('tenants', [PlatformController::class, 'tenants'])->name('tenants.index');
                Route::post('tenants', [PlatformController::class, 'provision'])->name('tenants.store');
                Route::post('tenants/validate-step', [PlatformController::class, 'validateStep'])->name('tenants.validate');
                Route::get('tenants/provision-options', [PlatformController::class, 'provisionOptions'])->name('tenants.options');
                Route::get('tenants/{id}', [PlatformController::class, 'tenant'])->name('tenants.show');
                Route::post('tenants/{id}/suspend', [PlatformController::class, 'suspend'])->name('tenants.suspend');
                Route::post('tenants/{id}/change-plan', [PlatformController::class, 'changePlan'])->name('tenants.change-plan');
                Route::patch('tenants/{id}', [PlatformController::class, 'updateTenant'])->name('tenants.update');
                Route::post('tenants/{id}/reactivate', [PlatformController::class, 'reactivate'])->name('tenants.reactivate');
                Route::get('plans', [PlatformController::class, 'plans'])->name('plans.index');
                Route::get('plans/{code}', [PlatformController::class, 'plan'])->name('plans.show');
                Route::put('plans/{code}', [PlatformController::class, 'updatePlan'])->name('plans.update');
            });

            foreach (glob(__DIR__.'/platform/*.php') ?: [] as $file) {
                require $file;
            }
        });
    });
});
