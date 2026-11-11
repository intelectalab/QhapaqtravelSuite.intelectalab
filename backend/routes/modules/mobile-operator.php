<?php

declare(strict_types=1);

use App\Domain\Mobile\Http\Controllers\OperatorController;
use Illuminate\Support\Facades\Route;

Route::prefix('mobile')->name('mobile.')->controller(OperatorController::class)->group(function (): void {
    Route::post('devices', 'registerDevice')->name('devices.store');
    Route::delete('devices/{id}', 'revokeDevice')->name('devices.destroy');

    Route::middleware('permission:operations.view')->prefix('operator')->name('operator.')->group(function (): void {
        Route::get('me', 'me')->name('me');
        Route::get('bootstrap', 'bootstrap')->name('bootstrap');
        Route::get('assignments/{id}', 'assignment')->name('assignments.show');
        Route::get('incidents', 'incidents')->name('incidents.index');
        Route::post('actions', 'action')->middleware('throttle:120,1')->name('actions');
        Route::post('sync', 'sync')->middleware('throttle:30,1')->name('sync');
        Route::post('incidents', 'storeIncident')->middleware('permission:operations.incidents')->name('incidents.store');
    });
});
