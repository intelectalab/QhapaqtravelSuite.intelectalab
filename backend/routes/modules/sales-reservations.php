<?php

declare(strict_types=1);

use App\Domain\Booking\Http\Controllers\ReservationController;
use Illuminate\Support\Facades\Route;

collect(Route::getRoutes()->getRoutes())->first(fn ($route): bool => $route->getName() === 'reservations.show')?->where('code', '(?!occupancy$)[^/]+');

Route::controller(ReservationController::class)->group(function (): void {
    Route::get('reservations/occupancy', 'occupancy')->middleware('permission:reservations.view')->name('reservations.occupancy');
    Route::get('reservations/{code}/confirm-preview', 'confirmPreview')->middleware('permission:reservations.modify')->name('reservations.confirm.preview');
});
