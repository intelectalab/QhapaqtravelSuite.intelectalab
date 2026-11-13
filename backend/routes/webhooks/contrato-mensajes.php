<?php

declare(strict_types=1);

use App\Domain\Marketing\Http\Controllers\DeliveryWebhookController;
use Illuminate\Support\Facades\Route;

Route::controller(DeliveryWebhookController::class)->middleware('throttle:600,1')->name('contrato-mensajes.webhooks.')->group(function (): void {
    Route::post('integrations/email/webhooks', 'email')->name('email');
    Route::post('integrations/whatsapp/webhooks/messages', 'whatsappMessages')->name('whatsapp.messages');
    Route::post('integrations/whatsapp/webhooks/templates', 'whatsappTemplates')->name('whatsapp.templates');
    Route::post('webhooks/providers/{provider}', 'providers')->whereIn('provider', ['ses', 'whatsapp', 'fcm'])->name('providers');
});
