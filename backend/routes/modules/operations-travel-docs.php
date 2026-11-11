<?php

declare(strict_types=1);

use App\Domain\Operations\Http\Controllers\TravelDocController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:operations.travel_docs|reservations.create')->group(function (): void {
    Route::get('ops/travel-docs', [TravelDocController::class, 'index'])->name('ops.travel-docs.index');
    Route::get('ops/travel-docs/passengers', [TravelDocController::class, 'passengers'])->name('ops.travel-docs.passengers');
    Route::get('settings/travel-docs', [TravelDocController::class, 'rules'])->name('ops.travel-docs.settings.show');
    Route::get('reservations/{code}/travel-docs', [TravelDocController::class, 'show'])->name('ops.travel-docs.show');
    Route::get('reservations/{code}/travel-docs/{passenger}/{type}/file', [TravelDocController::class, 'file'])->name('ops.travel-docs.file');
    Route::post('reservations/{code}/travel-docs/requests', [TravelDocController::class, 'requestDocuments'])->name('ops.travel-docs.requests');

    Route::middleware('permission:operations.travel_docs')->group(function (): void {
        Route::put('settings/travel-docs', [TravelDocController::class, 'settings'])->name('ops.travel-docs.settings');
        Route::post('ops/travel-docs/jobs/reminders', [TravelDocController::class, 'runReminders'])->name('ops.travel-docs.jobs.reminders');
        Route::post('reservations/{code}/travel-docs/{passenger}/{type}/validate', [TravelDocController::class, 'validateItem'])->name('ops.travel-docs.validate');
        Route::post('reservations/{code}/travel-docs/{passenger}/{type}/observe', [TravelDocController::class, 'observe'])->name('ops.travel-docs.observe');
        Route::post('reservations/{code}/travel-docs/{passenger}/{type}/files', [TravelDocController::class, 'upload'])->name('ops.travel-docs.files');
        Route::put('reservations/{code}/travel-docs/{passenger}/emergency-contact', [TravelDocController::class, 'contact'])->name('ops.travel-docs.contact');
        Route::put('reservations/{code}/travel-docs/{passenger}/special-attention', [TravelDocController::class, 'attention'])->name('ops.travel-docs.attention');
    });
});
