<?php

declare(strict_types=1);

use App\Domain\Admin\Http\Controllers\PaxMessageController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:admin.settings.manage|operations.assign')->name('admin.pax-messages.')->group(function (): void {
    Route::post('reservations/{code}/pax-messages', [PaxMessageController::class, 'store'])->name('store');
    Route::post('notifications/pax-messages/reschedule', [PaxMessageController::class, 'reschedule'])->name('reschedule');
    Route::post('notifications/pax-messages/{code}/send-now', [PaxMessageController::class, 'sendNow'])->name('send-now');
    Route::post('notifications/pax-messages/{code}/cancel', [PaxMessageController::class, 'cancel'])->name('cancel');
    Route::post('notifications/pax-messages/{code}/retry', [PaxMessageController::class, 'retry'])->name('retry');
});

Route::post('notifications/pax-templates/{code}/test', [PaxMessageController::class, 'test'])->middleware('permission:admin.settings.manage')->name('admin.pax-templates.test');
