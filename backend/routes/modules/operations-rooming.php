<?php

declare(strict_types=1);

use App\Domain\Operations\Http\Controllers\RoomingController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:operations.view')->prefix('ops')->group(function (): void {
    Route::get('rooming-lists', [RoomingController::class, 'index'])->name('ops.rooming.index');

    Route::middleware('permission:reservations.modify')->group(function (): void {
        Route::post('rooming-lists', [RoomingController::class, 'store'])->name('ops.rooming.store');
        Route::post('rooming/prefill', [RoomingController::class, 'prefill'])->name('ops.rooming.prefill');
        Route::delete('rooming-lists/{list}', [RoomingController::class, 'destroy'])->name('ops.rooming.destroy');
        Route::post('rooming-lists/{list}/rooms', [RoomingController::class, 'saveRoom'])->name('ops.rooming.rooms.store');
        Route::put('rooming-lists/{list}/rooms/{room}', [RoomingController::class, 'saveRoom'])->name('ops.rooming.rooms.update');
        Route::delete('rooming-lists/{list}/rooms/{room}', [RoomingController::class, 'deleteRoom'])->name('ops.rooming.rooms.destroy');
        Route::post('rooming-lists/{list}/confirm', [RoomingController::class, 'confirm'])->name('ops.rooming.confirm');
        Route::post('rooming-lists/{list}/send', [RoomingController::class, 'send'])->name('ops.rooming.send');
    });
});
