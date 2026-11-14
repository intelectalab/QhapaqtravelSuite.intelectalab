<?php

declare(strict_types=1);

use App\Domain\Operations\Http\Controllers\NoShowController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:operations.view')->prefix('ops')->name('operaciones.')->controller(NoShowController::class)->group(function (): void {
    Route::get('no-shows', 'index')->name('no-shows.index');
    Route::get('reservation-services/{service}/no-shows', 'forService')->name('reservation-services.no-shows.index');

    Route::middleware('permission:operations.assign')->group(function (): void {
        Route::post('reservation-services/{service}/no-shows', 'store')->name('reservation-services.no-shows.store');
        Route::patch('no-shows/{id}', 'update')->name('no-shows.update');
        Route::delete('no-shows/{id}', 'destroy')->name('no-shows.destroy');
    });
});
