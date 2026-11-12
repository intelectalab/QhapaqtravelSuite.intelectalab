<?php

declare(strict_types=1);

use App\Domain\Crm\Http\Controllers\ClaimBookController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:crm.claims.manage')->group(function (): void {
    Route::get('crm/claim-book', [ClaimBookController::class, 'index'])->name('crm.claims.index');
    Route::post('crm/claim-book', [ClaimBookController::class, 'store'])->name('crm.claims.store');
    Route::put('crm/claim-book/settings', [ClaimBookController::class, 'settings'])->middleware('permission:admin.settings.manage')->name('crm.claims.settings');
    Route::patch('crm/claim-book/{code}', [ClaimBookController::class, 'update'])->name('crm.claims.update');
    Route::post('crm/claim-book/{code}/review', [ClaimBookController::class, 'evaluate'])->name('crm.claims.evaluate');
    Route::post('crm/claim-book/{code}/response', [ClaimBookController::class, 'respond'])->name('crm.claims.respond');
    Route::post('crm/claim-book/{code}/response/resend', [ClaimBookController::class, 'resend'])->middleware('throttle:10,1')->name('crm.claims.resend');
    Route::post('crm/claim-book/{code}/close', [ClaimBookController::class, 'close'])->name('crm.claims.close');
});
