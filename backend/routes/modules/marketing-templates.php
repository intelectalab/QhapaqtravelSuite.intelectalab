<?php

declare(strict_types=1);

use App\Domain\Marketing\Http\Controllers\TemplateController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:marketing.campaigns.manage')->group(function (): void {
    Route::get('marketing/templates', [TemplateController::class, 'index'])->name('marketing.templates.index');
    Route::post('marketing/templates', [TemplateController::class, 'store'])->name('marketing.templates.store');
    Route::put('marketing/templates/{code}', [TemplateController::class, 'update'])->middleware('if-match:mkt_templates,code,code')->name('marketing.templates.update');
});
