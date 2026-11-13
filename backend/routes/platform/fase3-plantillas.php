<?php

declare(strict_types=1);

use App\Domain\SiteTemplates\Http\Controllers\PlatformTemplateController;
use Illuminate\Support\Facades\Route;

Route::middleware('platform.user:verified,admin.tenant.manage')->name('plantillas.')->controller(PlatformTemplateController::class)->group(function (): void {
    Route::get('templates', 'index')->name('templates.index');
    Route::post('templates', 'store')->name('templates.store');
    Route::patch('templates/{code}', 'update')->name('templates.update');
    Route::get('template-submissions', 'submissions')->name('submissions.index');
    Route::post('template-submissions', 'submit')->name('submissions.store');
    Route::post('template-submissions/{code}/decision', 'decide')->name('submissions.decision');
    Route::post('tenants/{id}/theme', 'assign')->name('tenants.theme');
    Route::get('ai/packs', 'packs')->name('ai.packs.index');
    Route::patch('ai/packs/{code}', 'updatePack')->name('ai.packs.update');
});
