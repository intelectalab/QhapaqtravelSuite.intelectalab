<?php

declare(strict_types=1);

use App\Domain\Catalog\Http\Controllers\ProductBookingController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:catalog.products.view')->group(function (): void {
    Route::get('catalog/products/{product}/booking-config', [ProductBookingController::class, 'show'])->name('catalog.products.booking-config');
    Route::get('catalog/products/{product}/pax-rules', [ProductBookingController::class, 'paxRules'])->name('catalog.products.pax-rules.show');
    Route::post('catalog/products/{product}/pax-rules/simulate', [ProductBookingController::class, 'simulate'])->name('catalog.products.pax-rules.simulate');
    Route::get('catalog/products/{product}/addons', [ProductBookingController::class, 'addons'])->name('catalog.products.addons.index');
    Route::get('catalog/products/{product}/payment-policy', [ProductBookingController::class, 'paymentPolicy'])->name('catalog.products.payment-policy.show');
    Route::get('catalog/products/{product}/pickup', [ProductBookingController::class, 'pickup'])->name('catalog.products.pickup.show');
    Route::get('catalog/products/{product}/rule-overrides', [ProductBookingController::class, 'ruleOverrides'])->name('catalog.products.rule-overrides.index');

    Route::middleware('permission:catalog.products.manage_availability')->group(function (): void {
        Route::put('catalog/products/{product}/operation', [ProductBookingController::class, 'operation'])->name('catalog.products.operation');
    });

    Route::put('catalog/products/{product}/pickup', [ProductBookingController::class, 'savePickup'])->middleware('permission:catalog.products.update|catalog.products.manage_availability')->name('catalog.products.pickup.update');

    Route::middleware('permission:catalog.products.update')->group(function (): void {
        Route::put('catalog/products/{product}/pax-rules', [ProductBookingController::class, 'savePaxRules'])->name('catalog.products.pax-rules.update');
        Route::delete('catalog/products/{product}/pax-rules', [ProductBookingController::class, 'resetPaxRules'])->name('catalog.products.pax-rules.destroy');
        Route::put('catalog/products/{product}/rule-overrides/{rule}', [ProductBookingController::class, 'saveRuleOverride'])->name('catalog.products.rule-overrides.update');
        Route::delete('catalog/products/{product}/rule-overrides/{rule}', [ProductBookingController::class, 'resetRuleOverride'])->name('catalog.products.rule-overrides.destroy');
    });

    Route::middleware('permission:catalog.products.manage_rates')->group(function (): void {
        Route::post('catalog/products/{product}/addons', [ProductBookingController::class, 'storeAddon'])->name('catalog.products.addons.store');
        Route::patch('catalog/products/{product}/addons/{addon}', [ProductBookingController::class, 'updateAddon'])->name('catalog.products.addons.update');
        Route::delete('catalog/products/{product}/addons/{addon}', [ProductBookingController::class, 'destroyAddon'])->name('catalog.products.addons.destroy');
        Route::put('catalog/products/{product}/accommodation', [ProductBookingController::class, 'accommodation'])->name('catalog.products.accommodation');
        Route::post('catalog/products/{product}/accommodation/legs', [ProductBookingController::class, 'storeLeg'])->name('catalog.products.accommodation.legs.store');
        Route::post('catalog/products/{product}/accommodation/legs/reorder', [ProductBookingController::class, 'reorderLegs'])->name('catalog.products.accommodation.legs.reorder');
        Route::patch('catalog/products/{product}/accommodation/legs/{leg}', [ProductBookingController::class, 'updateLeg'])->name('catalog.products.accommodation.legs.update');
        Route::delete('catalog/products/{product}/accommodation/legs/{leg}', [ProductBookingController::class, 'destroyLeg'])->name('catalog.products.accommodation.legs.destroy');
        Route::post('catalog/products/{product}/accommodation/legs/{leg}/hotels', [ProductBookingController::class, 'storeHotel'])->name('catalog.products.accommodation.hotels.store');
        Route::patch('catalog/products/{product}/accommodation/legs/{leg}/hotels/{hotel}', [ProductBookingController::class, 'updateHotel'])->whereUuid('hotel')->name('catalog.products.accommodation.hotels.update');
        Route::delete('catalog/products/{product}/accommodation/legs/{leg}/hotels/{hotel}', [ProductBookingController::class, 'destroyHotel'])->whereUuid('hotel')->name('catalog.products.accommodation.hotels.destroy');
        Route::put('catalog/products/{product}/payment-policy', [ProductBookingController::class, 'savePaymentPolicy'])->name('catalog.products.payment-policy.update');
        Route::delete('catalog/products/{product}/payment-policy', [ProductBookingController::class, 'resetPaymentPolicy'])->name('catalog.products.payment-policy.destroy');
    });
});
