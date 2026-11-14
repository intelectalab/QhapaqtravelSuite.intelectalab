<?php

declare(strict_types=1);

use App\Domain\Inbox\Http\Controllers\WhatsappConnectionController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:admin.settings.manage')->controller(WhatsappConnectionController::class)->name('decisiones-whatsapp.')->group(function (): void {
    Route::get('inbox/whatsapp/connection', 'show')->name('connection.show');
    Route::post('inbox/whatsapp/connection', 'connect')->middleware('throttle:10,1')->name('connection.connect');
    Route::put('inbox/whatsapp/connection/own-app', 'ownApp')->middleware('throttle:10,1')->name('connection.own-app');
    Route::delete('inbox/whatsapp/connection', 'disconnect')->name('connection.disconnect');
});
