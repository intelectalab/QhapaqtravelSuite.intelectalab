<?php

declare(strict_types=1);

use App\Domain\Platform\Http\Controllers\PlatformPlanRulesController;
use Illuminate\Support\Facades\Route;

Route::controller(PlatformPlanRulesController::class)->group(function (): void {
    Route::get('plan-rules', 'index')->name('plan-rules.index');
    Route::post('plan-rules/reset-demo', 'reset')->name('plan-rules.reset-demo');
    Route::put('plan-rules/{code}', 'update')->name('plan-rules.update');
});
