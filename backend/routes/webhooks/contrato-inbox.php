<?php

declare(strict_types=1);

use App\Domain\Inbox\Http\Controllers\InboundChannelController;
use Illuminate\Support\Facades\Route;

Route::controller(InboundChannelController::class)->middleware('throttle:240,1')->name('contrato-inbox.')->group(function (): void {
    Route::get('integrations/whatsapp/webhook', 'verifyWhatsapp')->name('whatsapp.webhook.verify');
    Route::post('integrations/whatsapp/webhook', 'whatsapp')->name('whatsapp.webhook');
    Route::post('integrations/email/inbound', 'email')->name('email.inbound');
});
