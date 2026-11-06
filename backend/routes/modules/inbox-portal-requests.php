<?php

declare(strict_types=1);

use App\Domain\Inbox\Http\Controllers\PortalRequestController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:approvals.view')->prefix('approvals')->name('approvals.portal.')->controller(PortalRequestController::class)->group(function (): void {
    Route::middleware('permission:finance.commissions')->group(function (): void {
        Route::post('settlements/{code}/approve', 'approveSettlement')->name('settlements.approve');
        Route::post('settlements/{code}/reject', 'rejectSettlement')->name('settlements.reject');
    });

    Route::middleware('permission:catalog.products.manage_rates|catalog.providers.manage')->group(function (): void {
        Route::post('provider-rates/{code}/approve', 'approveRate')->name('rates.approve');
        Route::post('provider-rates/{code}/reject', 'rejectRate')->name('rates.reject');
    });

    Route::middleware('permission:finance.payables')->group(function (): void {
        Route::post('supplier-invoices/{code}/validate', 'validateInvoice')->name('invoices.validate');
        Route::post('supplier-invoices/{code}/observe', 'observeInvoice')->name('invoices.observe');
    });
});
