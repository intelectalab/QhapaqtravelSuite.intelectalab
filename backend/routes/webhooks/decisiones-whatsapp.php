<?php

declare(strict_types=1);

use App\Domain\Inbox\Http\Controllers\OwnWhatsappWebhookController;
use Illuminate\Support\Facades\Route;

Route::controller(OwnWhatsappWebhookController::class)->middleware('throttle:240,1')->name('decisiones-whatsapp.')->group(function (): void {
    Route::get('integrations/whatsapp/webhook/{agency}', 'verify')->where('agency', '[a-z0-9-]{3,30}')->name('whatsapp.own.verify');
    Route::post('integrations/whatsapp/webhook/{agency}', 'receive')->where('agency', '[a-z0-9-]{3,30}')->name('whatsapp.own.receive');
});
