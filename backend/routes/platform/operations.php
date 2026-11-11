<?php

declare(strict_types=1);

use App\Domain\Platform\Http\Controllers\PlatformOperationsController;
use Illuminate\Support\Facades\Route;

Route::get('home', [PlatformOperationsController::class, 'home'])->name('home');
Route::get('operations', [PlatformOperationsController::class, 'operations'])->name('operations.index');
Route::post('jobs/{code}/run', [PlatformOperationsController::class, 'runJob'])->name('jobs.run');
Route::post('jobs/{code}/pause', [PlatformOperationsController::class, 'pauseJob'])->name('jobs.pause');
Route::post('integration-errors/{id}/retry', [PlatformOperationsController::class, 'retryError'])->name('integration-errors.retry');
Route::post('integration-errors/{id}/resolve', [PlatformOperationsController::class, 'resolveError'])->name('integration-errors.resolve');
Route::get('audit-events', [PlatformOperationsController::class, 'audit'])->middleware('platform.user:verified,admin.audit.view')->name('audit-events.index');
Route::get('audit-events/{id}', [PlatformOperationsController::class, 'auditEvent'])->middleware('platform.user:verified,admin.audit.view')->name('audit-events.show');
