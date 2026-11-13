<?php

declare(strict_types=1);

use App\Domain\Channels\Http\Controllers\OtaWebhookController;
use Illuminate\Support\Facades\Route;

Route::post('webhooks/ota/{ota}', OtaWebhookController::class)->middleware('throttle:120,1')->where('ota', '[a-z_]+')->name('crecimiento-a.webhooks.ota');
