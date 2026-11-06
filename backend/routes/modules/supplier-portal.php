<?php

declare(strict_types=1);

use App\Domain\SupplierPortal\Http\Controllers\SupplierPortalController;
use Illuminate\Support\Facades\Route;

Route::prefix('supplier')->name('supplier.')->controller(SupplierPortalController::class)->group(function (): void {
    Route::get('session', 'session')->middleware('permission:supplier.portal.view')->name('session');
    Route::get('home', 'home')->middleware('permission:supplier.portal.view')->name('home');
    Route::get('requests', 'requests')->middleware('permission:supplier.portal.view')->name('requests.index');
    Route::get('requests/{code}', 'request')->middleware('permission:supplier.portal.view')->name('requests.show');
    Route::post('requests/{code}/confirm', 'confirm')->middleware('permission:supplier.requests.respond')->name('requests.confirm');
    Route::post('requests/{code}/reject', 'reject')->middleware('permission:supplier.requests.respond')->name('requests.reject');
    Route::get('calendar', 'calendar')->middleware('permission:supplier.portal.view')->name('calendar');
    Route::get('rates', 'rates')->middleware('permission:supplier.portal.view')->name('rates.index');
    Route::post('rate-requests', 'storeRateRequest')->middleware('permission:supplier.rates.request')->name('rate-requests.store');
    Route::patch('rate-requests/{code}', 'updateRateRequest')->middleware('permission:supplier.rates.request')->name('rate-requests.update');
    Route::post('rate-requests/{code}/withdraw', 'withdrawRateRequest')->middleware('permission:supplier.rates.request')->name('rate-requests.withdraw');
    Route::get('payables', 'payables')->middleware('permission:supplier.payables.view')->name('payables.index');
    Route::post('payables/{code}/invoices', 'storeInvoice')->middleware('permission:supplier.invoices.upload')->name('payables.invoices.store');
    Route::delete('payables/{code}/invoices', 'annulInvoice')->middleware('permission:supplier.invoices.upload')->name('payables.invoices.destroy');
    Route::get('company', 'company')->middleware('permission:supplier.portal.view')->name('company');
    Route::post('company/contacts', 'storeContact')->middleware('permission:supplier.users.manage')->name('company.contacts.store');
    Route::patch('company/contacts/{id}', 'updateContact')->middleware('permission:supplier.users.manage')->name('company.contacts.update');
    Route::delete('company/contacts/{id}', 'deleteContact')->middleware('permission:supplier.users.manage')->name('company.contacts.destroy');
});
