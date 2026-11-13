<?php

declare(strict_types=1);

use App\Domain\SiteTemplates\Http\Controllers\AiContentController;
use App\Domain\SiteTemplates\Http\Controllers\SiteTemplateController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:cms.templates.manage')->name('plantillas.')->group(function (): void {
    Route::get('cms/templates', [SiteTemplateController::class, 'index'])->name('templates.index');
    Route::get('cms/templates/{code}', [SiteTemplateController::class, 'show'])->name('templates.show');
    Route::post('cms/templates/{code}/preview', [SiteTemplateController::class, 'preview'])->middleware('throttle:30,1')->name('templates.preview');
    Route::post('cms/templates/{code}/purchase', [SiteTemplateController::class, 'purchase'])->name('templates.purchase');
    Route::get('cms/theme', [SiteTemplateController::class, 'theme'])->name('theme.show');
    Route::put('cms/theme', [SiteTemplateController::class, 'apply'])->name('theme.apply');
    Route::patch('cms/theme/tokens', [SiteTemplateController::class, 'tokens'])->name('theme.tokens');
    Route::post('cms/theme/restore/{id}', [SiteTemplateController::class, 'restore'])->name('theme.restore');
});

Route::middleware('permission:ai.content.use')->name('plantillas.ai.')->group(function (): void {
    Route::get('cms/ai/jobs', [AiContentController::class, 'jobs'])->name('jobs.index');
    Route::post('cms/ai/jobs', [AiContentController::class, 'store'])->middleware('throttle:30,1')->name('jobs.store');
    Route::get('cms/ai/jobs/{code}', [AiContentController::class, 'show'])->name('jobs.show');
    Route::post('cms/ai/jobs/{code}/apply', [AiContentController::class, 'apply'])->name('jobs.apply');
    Route::post('cms/ai/jobs/{code}/discard', [AiContentController::class, 'discard'])->name('jobs.discard');
    Route::post('cms/ai/jobs/{code}/regenerate', [AiContentController::class, 'regenerate'])->middleware('throttle:30,1')->name('jobs.regenerate');
    Route::get('cms/ai/images', [AiContentController::class, 'images'])->name('images.index');
    Route::post('cms/ai/images', [AiContentController::class, 'storeImages'])->middleware('throttle:20,1')->name('images.store');
    Route::patch('cms/ai/images/{id}', [AiContentController::class, 'updateImage'])->whereUuid('id')->name('images.update');
    Route::get('cms/ai/images/{id}/file', [AiContentController::class, 'imageFile'])->whereUuid('id')->name('images.file');
    Route::get('cms/ai/credits', [AiContentController::class, 'credits'])->name('credits.show');
    Route::get('cms/ai/credits/ledger', [AiContentController::class, 'ledger'])->name('credits.ledger');
    Route::get('cms/ai/packs', [AiContentController::class, 'packs'])->name('packs.index');
    Route::post('cms/ai/packs/{code}/purchase', [AiContentController::class, 'purchasePack'])->name('packs.purchase');
});
