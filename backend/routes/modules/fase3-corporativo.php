<?php

declare(strict_types=1);

use App\Domain\Corporate\Http\Controllers\CorporateAccountController;
use App\Domain\Corporate\Http\Controllers\CorporateBookingController;
use App\Domain\Corporate\Http\Controllers\CorporatePortalController;
use App\Domain\Corporate\Http\Controllers\CorporateStatementController;
use App\Domain\Corporate\Http\Middleware\EnsureCorporatePortal;
use Illuminate\Support\Facades\Route;

Route::middleware(['permission:crm.corporate.manage', EnsureCorporatePortal::class])->prefix('crm/corporate-accounts')->name('corporativo.accounts.')->controller(CorporateAccountController::class)->group(function (): void {
    Route::get('/', 'index')->name('index');
    Route::get('form-options', 'options')->name('options');
    Route::post('/', 'store')->name('store');
    Route::get('{id}', 'show')->name('show');
    Route::patch('{id}', 'update')->name('update');
    Route::post('{id}/suspend', 'suspend')->name('suspend');
    Route::get('{id}/cost-centers', 'costCenters')->name('cost-centers.index');
    Route::post('{id}/cost-centers', 'storeCostCenter')->name('cost-centers.store');
    Route::patch('{id}/cost-centers/{costCenterId}', 'updateCostCenter')->name('cost-centers.update');
    Route::get('{id}/travelers', 'travelers')->name('travelers.index');
    Route::post('{id}/travelers/import', 'importTravelers')->name('travelers.import');
    Route::post('{id}/travelers', 'storeTraveler')->name('travelers.store');
    Route::patch('{id}/travelers/{travelerId}', 'updateTraveler')->name('travelers.update');
    Route::get('{id}/portal-users', 'portalUsers')->name('portal-users.index');
    Route::post('{id}/portal-users', 'storePortalUser')->name('portal-users.store');
    Route::patch('{id}/portal-users/{portalUserId}', 'updatePortalUser')->name('portal-users.update');
    Route::post('{id}/portal-users/{portalUserId}/resend-invite', 'resendInvite')->name('portal-users.resend');
});

Route::middleware(EnsureCorporatePortal::class)->controller(CorporateBookingController::class)->group(function (): void {
    Route::get('reservations/{code}/cost-allocations', 'allocations')->middleware('permission:crm.corporate.manage|reservations.view')->name('corporativo.reservations.cost-allocations.show');
    Route::put('reservations/{code}/cost-allocations', 'replaceAllocations')->middleware('permission:crm.corporate.manage|reservations.modify')->name('corporativo.reservations.cost-allocations.replace');
    Route::post('quotes/{code}/corporate-approval', 'requestApproval')->middleware('permission:quotes.send')->name('corporativo.quotes.approval');
});

Route::middleware(['permission:finance.corporate_statements', EnsureCorporatePortal::class])->prefix('finance/corporate-statements')->name('corporativo.statements.')->controller(CorporateStatementController::class)->group(function (): void {
    Route::get('/', 'index')->name('index');
    Route::post('/', 'store')->name('store');
    Route::get('{code}', 'show')->name('show');
    Route::get('{code}/pdf', 'pdf')->name('pdf');
    Route::post('{code}/send', 'send')->name('send');
    Route::post('{code}/void', 'void')->name('void');
});

Route::prefix('portal/client/corporate')->name('portal.corporativo.')->controller(CorporatePortalController::class)->group(function (): void {
    Route::get('summary', 'summary')->name('summary');
    Route::get('purchases', 'purchases')->name('purchases');
    Route::get('movements', 'movements')->name('movements');
    Route::get('statements', 'statements')->name('statements.index');
    Route::get('statements/{code}/pdf', 'statementPdf')->name('statements.pdf');
    Route::patch('statement-settings', 'statementSettings')->name('statement-settings');
    Route::get('approvals', 'approvals')->name('approvals.index');
    Route::post('approvals/{code}/approve', 'approve')->name('approvals.approve');
    Route::post('approvals/{code}/reject', 'reject')->name('approvals.reject');
    Route::get('users', 'users')->name('users.index');
    Route::post('users', 'inviteUser')->name('users.store');
    Route::patch('users/{portalUserId}', 'updateUser')->name('users.update');
    Route::get('cost-centers', 'costCenters')->name('cost-centers.index');
    Route::post('cost-centers', 'storeCostCenter')->name('cost-centers.store');
    Route::patch('cost-centers/{code}', 'updateCostCenter')->name('cost-centers.update');
    Route::get('travelers', 'travelers')->name('travelers.index');
    Route::post('travelers', 'storeTraveler')->name('travelers.store');
    Route::get('exports', 'exports')->name('exports.index');
    Route::post('exports', 'requestExport')->middleware('throttle:20,1')->name('exports.store');
    Route::get('exports/{code}', 'export')->name('exports.show');
});
