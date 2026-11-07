<?php

declare(strict_types=1);

use App\Domain\Finance\Http\Controllers\InvoiceController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:finance.invoicing')->group(function (): void {
    Route::get('finance/invoices', [InvoiceController::class, 'index'])->name('finance.invoices.index');
    Route::post('finance/invoices', [InvoiceController::class, 'store'])->name('finance.invoices.store');
    Route::get('finance/invoices/summary', [InvoiceController::class, 'summary'])->name('finance.invoices.summary');
    Route::post('finance/invoices/validate', [InvoiceController::class, 'validateDraft'])->name('finance.invoices.validate');
    Route::get('finance/receivables/{code}/invoice-draft', [InvoiceController::class, 'draft'])->name('finance.receivables.invoice-draft');
    Route::get('finance/invoices/{number}', [InvoiceController::class, 'show'])->name('finance.invoices.show');
    Route::post('finance/invoices/{number}/status-check', [InvoiceController::class, 'statusCheck'])->name('finance.invoices.status-check');
    Route::post('finance/invoices/{number}/resend', [InvoiceController::class, 'resend'])->name('finance.invoices.resend');
    Route::post('finance/invoices/{number}/deliver', [InvoiceController::class, 'deliver'])->name('finance.invoices.deliver');
});
