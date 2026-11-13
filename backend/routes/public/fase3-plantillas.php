<?php

declare(strict_types=1);

use App\Domain\Site\Http\Middleware\ScopeSiteTenant;
use App\Domain\SiteTemplates\Http\Controllers\SiteTemplateController;
use Illuminate\Support\Facades\Route;

Route::middleware(['public.site', ScopeSiteTenant::class])->name('plantillas.')->group(function (): void {
    Route::get('site/theme', [SiteTemplateController::class, 'publicTheme'])->name('site.theme');
});
