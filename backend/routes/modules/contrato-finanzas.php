<?php

declare(strict_types=1);

use App\Domain\Crm\Http\Controllers\ClaimBookController;
use App\Domain\Crm\Http\Controllers\PortalClaimBookController;
use App\Domain\Finance\Http\Controllers\CommissionController;
use App\Domain\Finance\Http\Controllers\InvoiceController;
use App\Domain\Finance\Http\Controllers\PayableController;
use App\Domain\Finance\Http\Controllers\PaymentController;
use App\Domain\Finance\Http\Controllers\ProfitabilityController;
use App\Domain\Finance\Http\Controllers\ReceivableController;
use App\Domain\Finance\Http\Controllers\TreasuryController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:finance.receivables')->group(function (): void {
    Route::get('finance/receivables/summary', [ReceivableController::class, 'summary'])->name('finance.receivables.summary');
    Route::get('finance/reservations/{code}/account', [ReceivableController::class, 'account'])->name('finance.reservations.account');
});

Route::post('finance/reservations/{code}/account-statement', [ReceivableController::class, 'statement'])->middleware('permission:finance.payments.register')->name('finance.reservations.account-statement');

Route::middleware('permission:finance.payments.register')->group(function (): void {
    Route::post('finance/payments/{code}/validate', [PaymentController::class, 'validatePayment'])->where('code', 'PAG-[0-9]+')->name('finance.payments.validate');
    Route::post('finance/payments/{code}/apply', [PaymentController::class, 'apply'])->where('code', 'PAG-[0-9]+')->name('finance.payments.apply');
});

Route::middleware('permission:finance.payables')->group(function (): void {
    Route::get('finance/payables/summary', [PayableController::class, 'summary'])->name('finance.payables.summary');
    Route::get('finance/payables/by-provider', [PayableController::class, 'byProvider'])->name('finance.payables.by-provider');
    Route::post('finance/costs/preview', [PayableController::class, 'preview'])->name('finance.costs.preview');
    Route::post('finance/costs', [PayableController::class, 'store'])->middleware('permission:finance.payments.register')->name('finance.costs.store');
});

Route::get('finance/bank-accounts', [PayableController::class, 'bankAccounts'])->middleware('permission:finance.payables|finance.payments.register')->name('finance.bank-accounts.index');

Route::get('finance/commissions/summary', [CommissionController::class, 'summary'])->middleware('permission:finance.commissions')->name('finance.commissions.summary');

Route::get('finance/profitability/reservations', [ProfitabilityController::class, 'reservations'])->middleware('permission:finance.profitability')->name('finance.profitability.reservations');

Route::middleware('permission:finance.invoicing')->group(function (): void {
    Route::get('finance/invoices/{number}/xml', [InvoiceController::class, 'xml'])->name('finance.invoices.xml');
    Route::get('finance/invoices/{number}/cdr', [InvoiceController::class, 'cdr'])->name('finance.invoices.cdr');
    Route::post('finance/invoices/{number}/void', [InvoiceController::class, 'void'])->name('finance.invoices.void');
});

Route::get('treasury/movements', [TreasuryController::class, 'movements'])->middleware('permission:finance.treasury')->name('finance.treasury.movements.index');

Route::middleware('permission:crm.claims.manage')->group(function (): void {
    Route::get('crm/claim-book/settings', [ClaimBookController::class, 'currentSettings'])->name('crm.claims.settings.show');
    Route::get('crm/claim-book/reports', [ClaimBookController::class, 'reports'])->name('crm.claims.reports');
    Route::post('crm/claim-book/exports', [ClaimBookController::class, 'export'])->middleware(['permission:reports.export', 'throttle:exports'])->name('crm.claims.exports');
    Route::get('crm/claim-book/{id}', [ClaimBookController::class, 'show'])->name('crm.claims.show');
    Route::get('crm/claim-book/{id}/certificate', [ClaimBookController::class, 'certificate'])->name('crm.claims.certificate');
    Route::patch('crm/claim-book/{id}/links', [ClaimBookController::class, 'links'])->name('crm.claims.links');
});

Route::prefix('portal/claim-book')->name('portal.claim-book.')->controller(PortalClaimBookController::class)->group(function (): void {
    Route::get('/', 'index')->name('index');
    Route::post('/', 'store')->middleware('throttle:10,1')->name('store');
});
