<?php

declare(strict_types=1);

use App\Domain\Channels\Http\Controllers\WebIntegrationController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:admin.api.manage')->group(function (): void {
    Route::post('channels/widget/rotate-key', [WebIntegrationController::class, 'rotateKey'])->middleware('idempotent')->name('channels.web.rotate-key');
});
