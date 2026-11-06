<?php

declare(strict_types=1);

use App\Domain\Platform\Http\Controllers\PlatformBillingController;
use Illuminate\Support\Facades\Route;

Route::get('metrics', [PlatformBillingController::class, 'metrics'])->name('billing.metrics');
Route::get('invoices', [PlatformBillingController::class, 'invoices'])->name('invoices.index');
Route::get('invoices/{id}', [PlatformBillingController::class, 'invoice'])->name('invoices.show');
Route::post('invoices/{id}/retry', [PlatformBillingController::class, 'retry'])->name('invoices.retry');
Route::post('invoices/{id}/manual-payment', [PlatformBillingController::class, 'manualPayment'])->name('invoices.manual-payment');
Route::post('invoices/{id}/void', [PlatformBillingController::class, 'void'])->name('invoices.void');
Route::post('invoices/{id}/dunning/extend', [PlatformBillingController::class, 'extend'])->name('invoices.dunning.extend');
Route::post('invoices/{id}/dunning/suspend', [PlatformBillingController::class, 'suspend'])->name('invoices.dunning.suspend');
Route::get('dunning', [PlatformBillingController::class, 'dunning'])->name('dunning.index');
Route::patch('dunning-policy', [PlatformBillingController::class, 'dunningPolicy'])->name('dunning.policy');
Route::get('trials', [PlatformBillingController::class, 'trials'])->name('trials.index');
Route::post('trials/{tenant}/extend', [PlatformBillingController::class, 'extendTrial'])->name('trials.extend');
Route::post('trials/{tenant}/convert', [PlatformBillingController::class, 'convertTrial'])->name('trials.convert');
Route::get('coupons', [PlatformBillingController::class, 'coupons'])->name('coupons.index');
Route::post('coupons', [PlatformBillingController::class, 'storeCoupon'])->name('coupons.store');
Route::patch('coupons/{code}', [PlatformBillingController::class, 'updateCoupon'])->name('coupons.update');
Route::post('coupons/{code}/status', [PlatformBillingController::class, 'couponStatus'])->name('coupons.status');
Route::get('features', [PlatformBillingController::class, 'flags'])->name('features.index');
Route::put('features/{feature}/plans/{plan}', [PlatformBillingController::class, 'planFeature'])->name('features.plan');
Route::post('feature-overrides', [PlatformBillingController::class, 'storeOverride'])->name('overrides.store');
Route::delete('feature-overrides/{id}', [PlatformBillingController::class, 'deleteOverride'])->name('overrides.destroy');
Route::get('usage', [PlatformBillingController::class, 'usage'])->name('usage.index');
