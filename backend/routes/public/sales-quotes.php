<?php

declare(strict_types=1);

use App\Domain\Quotes\Http\Controllers\PublicQuoteController;
use Illuminate\Support\Facades\Route;

Route::get('quotes/{token}', [PublicQuoteController::class, 'show'])->middleware('throttle:30,1')->name('quotes.show');
