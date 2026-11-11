<?php

declare(strict_types=1);

use App\Domain\Admin\Http\Controllers\RuleController;
use Illuminate\Support\Facades\Route;

Route::get('admin/booking-rules/simulator', [RuleController::class, 'simulatorOptions'])->middleware('permission:admin.settings.manage')->name('admin.rules.simulator');
Route::post('admin/booking-rules/simulate', [RuleController::class, 'simulate'])->middleware('permission:admin.settings.manage')->name('admin.rules.simulate');
