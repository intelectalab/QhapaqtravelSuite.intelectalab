<?php

declare(strict_types=1);

use App\Domain\Finance\Http\Controllers\InvoiceController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:finance.invoicing')->group(function (): void {
    Route::get('finance/invoices', [InvoiceController::class, 'index'])->name('finance.invoices.index');
    Route::post('finance/invoices/{number}/credit-notes', [InvoiceController::class, 'creditNote'])->name('finance.invoices.credit-notes.store');
    Route::post('finance/invoices/{number}/fiscal-status', [InvoiceController::class, 'fiscalStatus'])->name('finance.invoices.fiscal-status');
});
