<?php

declare(strict_types=1);

use App\Domain\Documents\Http\Controllers\DocumentController;
use Illuminate\Support\Facades\Route;

Route::controller(DocumentController::class)->group(function (): void {
    Route::post('quotes/{code}/versions/{version}/pdf', 'queueQuote')->whereNumber('version')->middleware('permission:quotes.view')->name('documents.quotes.queue');
    Route::get('quotes/{code}/versions/{version}/pdf', 'quote')->whereNumber('version')->middleware('permission:quotes.view')->name('documents.quotes.show');
    Route::get('reservations/{code}/documents/confirmation', 'confirmation')->middleware('permission:reservations.view')->name('documents.reservations.confirmation');
    Route::get('ops/vouchers/{code}/pdf', 'opsVoucher')->middleware('permission:operations.view')->name('documents.ops.vouchers');
    Route::get('finance/invoices/{number}/pdf', 'invoice')->middleware('permission:finance.invoicing')->name('documents.finance.invoices');
    Route::get('portal/client/quotes/{code}/pdf', 'portalQuote')->middleware('permission:quotes.view')->name('portal.quotes.pdf');
    Route::get('portal/client/reservations/{code}/itinerary.pdf', 'portalItinerary')->middleware('permission:reservations.view')->name('portal.trips.itinerary');
    Route::get('b2b/vouchers/{code}/pdf', 'b2bVoucher')->name('b2b.vouchers.pdf');
    Route::get('documents/{id}/download', 'download')->name('documents.download');
    Route::post('catalog/products/{code}/sheet', 'productSheet')->middleware(['permission:catalog.products.view', 'throttle:20,1'])->name('catalog.products.sheet');
});
