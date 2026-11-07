<?php

declare(strict_types=1);

use App\Domain\Operations\Http\Controllers\OrderController;
use App\Domain\Operations\Http\Controllers\ResourceController;
use App\Domain\Operations\Support\OrderFlow;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:operations.view')->prefix('ops')->group(function (): void {
    Route::get('orders', [OrderController::class, 'index'])->name('ops.orders.index');
    Route::get('orders/{code}', [OrderController::class, 'show'])->name('ops.orders.show');
    Route::get('calendar', [ResourceController::class, 'calendar'])->name('ops.calendar');

    Route::middleware('permission:operations.assign')->group(function (): void {
        Route::post('orders', [OrderController::class, 'store'])->name('ops.orders.store');
        Route::patch('orders/{code}', [OrderController::class, 'update'])->name('ops.orders.update');
        foreach (array_keys(OrderFlow::ACTIONS) as $action) {
            Route::post("orders/{code}/{$action}", [OrderController::class, 'advance'])->defaults('action', $action)->name("ops.orders.{$action}");
        }
        Route::post('orders/{code}/cancel', [OrderController::class, 'cancel'])->name('ops.orders.cancel');
        Route::post('orders/{code}/tasks', [OrderController::class, 'addTask'])->name('ops.orders.tasks.store');
        Route::patch('order-tasks/{task}', [OrderController::class, 'updateTask'])->name('ops.tasks.update');
        Route::delete('order-tasks/{task}', [OrderController::class, 'deleteTask'])->name('ops.tasks.destroy');
        Route::put('assignments/{assignment}/resources', [OrderController::class, 'assign'])->name('ops.assignments.resources');
        Route::post('assignments/{assignment}/confirm', [OrderController::class, 'confirmAssignment'])->name('ops.assignments.confirm');
        Route::post('assignments/{assignment}/release', [OrderController::class, 'releaseAssignment'])->name('ops.assignments.release');
    });
});
