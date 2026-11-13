<?php

declare(strict_types=1);

use App\Domain\Tracking\Http\Controllers\PayloadWebhookController;
use Illuminate\Support\Facades\Route;

Route::post('platform/blog/webhooks/payload', PayloadWebhookController::class)->middleware('throttle:60,1')->name('seguimiento.payload.webhook');
