<?php

declare(strict_types=1);

use App\Domain\Crm\Http\Controllers\ClaimBookController;
use App\Domain\Inbox\Http\Controllers\ConversationController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:crm.claims.manage')->group(function (): void {
    Route::get('crm/claim-book/{code}/audit', [ClaimBookController::class, 'audit'])->name('brechas-g8.claims.audit');
    Route::post('crm/claim-book/{code}/notes', [ClaimBookController::class, 'note'])->name('brechas-g8.claims.note');
    Route::post('crm/claim-book/deadline-alerts', [ClaimBookController::class, 'alerts'])->middleware('throttle:5,1')->name('brechas-g8.claims.alerts');
});

Route::middleware('permission:inbox.view')->group(function (): void {
    Route::get('inbox/conversations/{code}/audit', [ConversationController::class, 'audit'])->name('brechas-g8.inbox.audit');
    Route::get('inbox/conversations/{code}/attachments/{attachment}', [ConversationController::class, 'download'])->whereUuid('attachment')->name('brechas-g8.inbox.attachment');
});
