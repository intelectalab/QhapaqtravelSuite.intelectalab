<?php

declare(strict_types=1);

use App\Domain\Site\Http\Controllers\PaymentWebhookController;
use Illuminate\Support\Facades\Route;

Route::post('webhooks/payments/{gateway}', PaymentWebhookController::class)->middleware('throttle:120,1')->where('gateway', '[a-z0-9_-]+')->name('webhooks.payments');
