<?php

declare(strict_types=1);

use App\Domain\Inbox\Http\Controllers\ConversationController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:inbox.view')->group(function (): void {
    Route::get('inbox/conversations', [ConversationController::class, 'index'])->name('inbox.conversations.index');
    Route::get('inbox/conversations/{code}', [ConversationController::class, 'show'])->name('inbox.conversations.show');

    Route::middleware('permission:inbox.manage')->group(function (): void {
        Route::post('inbox/conversations/{code}/messages', [ConversationController::class, 'reply'])->name('inbox.conversations.reply');
        Route::post('inbox/conversations/{code}/assign', [ConversationController::class, 'assign'])->name('inbox.conversations.assign');
        Route::post('inbox/conversations/{code}/resolve', [ConversationController::class, 'resolve'])->name('inbox.conversations.resolve');
        Route::post('inbox/conversations/{code}/reopen', [ConversationController::class, 'reopen'])->name('inbox.conversations.reopen');
        Route::patch('inbox/conversations/{code}', [ConversationController::class, 'update'])->name('inbox.conversations.update');
    });
});
