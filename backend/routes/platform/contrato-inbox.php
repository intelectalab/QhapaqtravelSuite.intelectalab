<?php

declare(strict_types=1);

use App\Domain\Platform\Http\Controllers\WhatsappWebhookSettingsController;
use Illuminate\Support\Facades\Route;

Route::put('settings/whatsapp-webhook', WhatsappWebhookSettingsController::class)->name('contrato-inbox.settings.whatsapp-webhook');
