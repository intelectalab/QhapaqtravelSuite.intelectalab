<?php

declare(strict_types=1);

use App\Domain\Finance\Http\Controllers\FiscalWebhookController;
use Illuminate\Support\Facades\Route;

Route::post('integrations/fiscal/{provider}/webhook', FiscalWebhookController::class)->middleware('throttle:120,1')->where('provider', '[A-Za-z0-9-]{3,20}')->name('contrato-fiscal.webhook');
