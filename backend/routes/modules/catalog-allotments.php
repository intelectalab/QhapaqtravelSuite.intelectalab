<?php

declare(strict_types=1);

use App\Domain\Catalog\Http\Controllers\AllotmentController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:catalog.allotments.manage|catalog.products.view_profitability')->group(function (): void {
    Route::get('catalog/allotments', [AllotmentController::class, 'index'])->name('catalog.allotments.index');
    Route::get('catalog/allotments/grid', [AllotmentController::class, 'grid'])->name('catalog.allotments.grid');
    Route::get('catalog/allotments/pickup', [AllotmentController::class, 'pickup'])->name('catalog.allotments.pickup');

    Route::middleware('permission:catalog.allotments.manage')->group(function (): void {
        Route::post('catalog/allotments', [AllotmentController::class, 'store'])->name('catalog.allotments.store');
        Route::post('catalog/allotments/jobs/release', [AllotmentController::class, 'runJob'])->name('catalog.allotments.jobs.release');
        Route::patch('catalog/allotments/{code}', [AllotmentController::class, 'update'])->name('catalog.allotments.update');
        Route::delete('catalog/allotments/{code}', [AllotmentController::class, 'destroy'])->name('catalog.allotments.destroy');
        Route::post('catalog/allotments/{code}/release', [AllotmentController::class, 'release'])->name('catalog.allotments.release');
        Route::post('catalog/allotments/{code}/days/{date}/release', [AllotmentController::class, 'releaseDay'])->name('catalog.allotments.days.release');
        Route::put('catalog/allotments/{code}/days/{date}/retention', [AllotmentController::class, 'retain'])->name('catalog.allotments.days.retain');
        Route::delete('catalog/allotments/{code}/days/{date}/retention', [AllotmentController::class, 'unretain'])->name('catalog.allotments.days.unretain');
        Route::post('catalog/allotments/{code}/requests', [AllotmentController::class, 'storeRequest'])->name('catalog.allotments.requests.store');
        Route::post('catalog/allotments/{code}/requests/{requestCode}/respond', [AllotmentController::class, 'respondRequest'])->name('catalog.allotments.requests.respond');
    });

    Route::get('catalog/allotments/{code}', [AllotmentController::class, 'show'])->name('catalog.allotments.show');
});
