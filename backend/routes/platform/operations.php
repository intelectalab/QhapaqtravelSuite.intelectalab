<?php

declare(strict_types=1);

use App\Domain\Platform\Http\Controllers\PlatformOperationsController;
use Illuminate\Support\Facades\Route;

Route::get('home', [PlatformOperationsController::class, 'home'])->name('home');
Route::get('operations', [PlatformOperationsController::class, 'operations'])->name('operations.index');
Route::post('jobs/{code}/run', [PlatformOperationsController::class, 'runJob'])->name('jobs.run');
Route::post('jobs/{code}/pause', [PlatformOperationsController::class, 'pauseJob'])->name('jobs.pause');
Route::get('audit-events', [PlatformOperationsController::class, 'audit'])->middleware('platform.user:verified,admin.audit.view')->name('audit-events.index');
