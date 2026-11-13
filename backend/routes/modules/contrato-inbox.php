<?php

declare(strict_types=1);

use App\Domain\Inbox\Http\Controllers\ChannelAccountController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:admin.settings.manage')->controller(ChannelAccountController::class)->name('contrato-inbox.')->group(function (): void {
    Route::get('inbox/channel-accounts', 'index')->name('channel-accounts.index');
    Route::put('inbox/channel-accounts/{channel}', 'update')->whereIn('channel', ['whatsapp', 'email'])->name('channel-accounts.update');
});
