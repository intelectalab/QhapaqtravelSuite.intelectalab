<?php

declare(strict_types=1);

use App\Domain\Platform\Http\Controllers\PlatformEntitlementController;
use Illuminate\Support\Facades\Route;

Route::controller(PlatformEntitlementController::class)->name('fase3.')->group(function (): void {
    Route::get('feature-overrides', 'overrides')->name('overrides.index');
    Route::delete('feature-overrides', 'deleteOverrides')->name('overrides.destroy-by-feature');
    Route::get('dunning-policy', 'dunningPolicy')->name('dunning.policy.show');
    Route::get('features/{key}/plans/{plan}', 'planFeature')->name('features.plan.show');
    Route::patch('coupons', 'updateCoupon')->name('coupons.update-by-code');
    Route::patch('plans/{code}', 'updatePlan')->middleware('platform.user:verified,admin.tenant.manage')->name('plans.patch');
});
