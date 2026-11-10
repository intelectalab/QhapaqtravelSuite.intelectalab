<?php

declare(strict_types=1);

use App\Domain\Documents\Http\Controllers\DocumentController;
use App\Domain\Site\Http\Middleware\ScopeSiteTenant;
use Illuminate\Support\Facades\Route;

Route::middleware(['public.site', ScopeSiteTenant::class])->name('site.documents.')->group(function (): void {
    Route::get('orders/{code}/vouchers/{voucher}.pdf', [DocumentController::class, 'publicVoucher'])->middleware('throttle:30,1')->name('vouchers');
});
