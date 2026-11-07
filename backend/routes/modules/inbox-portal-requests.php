<?php

declare(strict_types=1);

use App\Domain\Inbox\Http\Controllers\PortalRequestController;
use Illuminate\Support\Facades\Route;

Route::middleware(['permission:approvals.view', 'permission:finance.payables'])->prefix('finance/supplier-invoices')->name('approvals.portal.')->controller(PortalRequestController::class)->group(function (): void {
    Route::post('{code}/validate', 'validateInvoice')->name('invoices.validate');
    Route::post('{code}/observe', 'observeInvoice')->name('invoices.observe');
});
