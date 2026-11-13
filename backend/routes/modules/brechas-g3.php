<?php

declare(strict_types=1);

use App\Domain\Mobile\Http\Controllers\MobileDeviceController;
use App\Domain\Portal\Http\Controllers\PassengerPortalController;
use Illuminate\Support\Facades\Route;

Route::get('mobile/passenger/feedback', [PassengerPortalController::class, 'feedback'])->name('mobile.passenger.feedback.index');

Route::post('ops/mobile-devices/{id}/revoke', [MobileDeviceController::class, 'revoke'])->middleware('permission:operations.assign')->name('ops.mobile-devices.revoke');
