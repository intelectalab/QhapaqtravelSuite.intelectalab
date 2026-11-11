<?php

declare(strict_types=1);

use App\Domain\Marketing\Http\Controllers\ConsentController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:marketing.campaigns.manage')->group(function (): void {
    Route::get('marketing/contacts', [ConsentController::class, 'contacts'])->name('marketing.contacts.index');
    Route::get('marketing/consents', [ConsentController::class, 'index'])->name('marketing.consents.index');
    Route::post('marketing/consents', [ConsentController::class, 'store'])->name('marketing.consents.store');
    Route::post('marketing/consents/{code}/revoke', [ConsentController::class, 'revoke'])->name('marketing.consents.revoke');
    Route::get('marketing/consents/{code}/events', [ConsentController::class, 'events'])->name('marketing.consents.events');
});
