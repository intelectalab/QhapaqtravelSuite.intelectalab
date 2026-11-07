<?php

declare(strict_types=1);

use App\Domain\Channels\Http\Controllers\WebIntegrationController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:channels.ecommerce.manage|admin.api.manage')->group(function (): void {
    Route::get('channels/widget', [WebIntegrationController::class, 'index'])->name('channels.web.index');

    Route::middleware('permission:channels.ecommerce.manage')->group(function (): void {
        Route::put('channels/widget', [WebIntegrationController::class, 'defaults'])->name('channels.web.defaults');
        Route::post('channels/widget/domains', [WebIntegrationController::class, 'storeDomain'])->name('channels.web.domains.store');
        Route::post('channels/widget/domains/{id}/verify', [WebIntegrationController::class, 'verifyDomain'])->whereUuid('id')->name('channels.web.domains.verify');
        Route::delete('channels/widget/domains/{id}', [WebIntegrationController::class, 'destroyDomain'])->whereUuid('id')->name('channels.web.domains.destroy');
    });
});
