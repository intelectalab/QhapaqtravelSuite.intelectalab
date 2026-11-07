<?php

declare(strict_types=1);

use App\Domain\Site\Http\Controllers\SiteFormController;
use App\Domain\Site\Http\Middleware\ScopeSiteTenant;
use Illuminate\Support\Facades\Route;

Route::middleware(['public.site', ScopeSiteTenant::class, 'throttle:10,1'])->name('site.forms.')->group(function (): void {
    Route::post('leads', [SiteFormController::class, 'lead'])->name('leads');
    Route::post('contact', [SiteFormController::class, 'contact'])->name('contact');
    Route::post('newsletter', [SiteFormController::class, 'newsletter'])->name('newsletter');
    Route::post('claims', [SiteFormController::class, 'claim'])->name('claims');
});
