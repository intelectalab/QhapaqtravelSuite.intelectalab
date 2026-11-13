<?php

declare(strict_types=1);

use App\Domain\Finance\Http\Controllers\AccountingExportController;
use App\Domain\Finance\Http\Controllers\GiftCardController;
use App\Domain\Finance\Http\Controllers\PaymentLinkController;
use App\Domain\Operations\Http\Controllers\CheckinController;
use App\Domain\Portal\Http\Controllers\PassengerPassController;
use App\Domain\Quotes\Http\Controllers\ExternalOfferController;
use App\Domain\Reports\Http\Controllers\InsightController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:finance.payment_links')->prefix('finance/payment-links')->name('crecimiento-a.finance.payment-links.')->controller(PaymentLinkController::class)->group(function (): void {
    Route::get('/', 'index')->name('index');
    Route::post('/', 'store')->middleware('throttle:60,1')->name('store');
    Route::post('{code}/send', 'send')->middleware('throttle:30,1')->name('send');
    Route::post('{code}/cancel', 'cancel')->name('cancel');
});

Route::middleware('permission:finance.gift_cards')->prefix('finance/gift-cards')->name('crecimiento-a.finance.gift-cards.')->controller(GiftCardController::class)->group(function (): void {
    Route::get('/', 'index')->name('index');
    Route::post('/', 'store')->middleware('throttle:60,1')->name('store');
    Route::get('{code}', 'show')->name('show');
    Route::post('{code}/redeem', 'redeem')->middleware('throttle:30,1')->name('redeem');
    Route::post('{code}/void', 'void')->name('void');
});

Route::middleware('permission:finance.accounting_export')->name('crecimiento-a.finance.')->controller(AccountingExportController::class)->group(function (): void {
    Route::get('finance/account-mappings', 'mappings')->name('account-mappings.show');
    Route::put('finance/account-mappings', 'saveMappings')->name('account-mappings.update');
    Route::get('finance/accounting-exports', 'index')->name('accounting-exports.index');
    Route::post('finance/accounting-exports', 'store')->middleware('throttle:exports')->name('accounting-exports.store');
});

Route::middleware('permission:operations.checkin')->name('crecimiento-a.ops.checkin.')->controller(CheckinController::class)->group(function (): void {
    Route::post('ops/checkin/scan', 'scan')->middleware('throttle:240,1')->name('scan');
    Route::get('ops/checkin/manifest/{serviceId}', 'manifest')->name('manifest');
    Route::get('ops/waiver-templates', 'templates')->name('waiver-templates.index');
    Route::post('ops/waiver-templates', 'storeTemplate')->name('waiver-templates.store');
});

Route::prefix('portal/passenger')->name('portal.passenger.crecimiento-a.')->controller(PassengerPassController::class)->group(function (): void {
    Route::get('passes', 'index')->name('passes.index');
    Route::post('waivers', 'sign')->middleware('throttle:20,1')->name('waivers.store');
});

Route::middleware('permission:quotes.external_offers')->prefix('quotes/{id}/external-offers')->name('crecimiento-a.quotes.external-offers.')->controller(ExternalOfferController::class)->group(function (): void {
    Route::post('search', 'search')->middleware('throttle:60,1')->name('search');
    Route::post('/', 'store')->name('store');
    Route::delete('{offerId}', 'destroy')->name('destroy');
});

Route::middleware('permission:ai.insights.view')->prefix('reports/insights')->name('crecimiento-a.reports.insights.')->controller(InsightController::class)->group(function (): void {
    Route::get('/', 'index')->name('index');
    Route::post('{id}/resolve', 'resolve')->name('resolve');
});
