<?php

declare(strict_types=1);

use App\Domain\Quotes\Http\Controllers\QuoteController;
use Illuminate\Support\Facades\Route;

Route::controller(QuoteController::class)->group(function (): void {
    Route::post('quotes/{code}/token', 'token')->middleware('permission:quotes.send')->name('quotes.token');
});
