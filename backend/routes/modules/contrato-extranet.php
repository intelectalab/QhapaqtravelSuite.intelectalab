<?php

declare(strict_types=1);

use App\Domain\SupplierPortal\Http\Controllers\SupplierBackofficeController;
use App\Domain\SupplierPortal\Http\Controllers\SupplierContractController;
use Illuminate\Support\Facades\Route;

Route::prefix('supplier')->name('supplier.contract.')->middleware('permission:supplier.portal.view')->controller(SupplierContractController::class)->group(function (): void {
    Route::get('me', 'me')->name('me');
    Route::get('dashboard', 'dashboard')->name('dashboard');
    Route::get('contract', 'contract')->name('contract');
    Route::get('rate-requests', 'rateRequests')->name('rate-requests.index');
});

Route::controller(SupplierBackofficeController::class)->name('contract.backoffice.')->group(function (): void {
    Route::get('catalog/rate-requests', 'rateRequests')->middleware('permission:catalog.providers.manage')->name('rate-requests.index');
    Route::post('catalog/rate-requests/{id}/approve', 'approveRateRequest')->middleware('permission:catalog.products.manage_rates')->name('rate-requests.approve');
    Route::post('catalog/rate-requests/{id}/reject', 'rejectRateRequest')->middleware('permission:catalog.products.manage_rates')->name('rate-requests.reject');
    Route::post('catalog/providers/{id}/users', 'inviteProviderUser')->middleware(['permission:catalog.providers.manage', 'permission:admin.users.manage'])->name('providers.users.store');
    Route::post('finance/supplier-invoices/{id}/reject', 'rejectInvoice')->middleware('permission:finance.payables')->name('supplier-invoices.reject');
});
