<?php

declare(strict_types=1);

use App\Domain\Showcase\Http\Controllers\TravelStoryController;
use App\Domain\Site\Http\Middleware\ScopeSiteTenant;
use Illuminate\Support\Facades\Route;

Route::middleware(['public.site', ScopeSiteTenant::class])->name('site.vitrina.')->group(function (): void {
    Route::get('stories', [TravelStoryController::class, 'published'])->name('stories.index');
    Route::get('stories/{slug}', [TravelStoryController::class, 'publishedOne'])->name('stories.show');
});
