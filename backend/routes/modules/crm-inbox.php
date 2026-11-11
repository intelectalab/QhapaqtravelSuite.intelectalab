<?php

declare(strict_types=1);

use App\Domain\Crm\Http\Controllers\ConversationCrmController;
use Illuminate\Support\Facades\Route;

Route::middleware(['permission:inbox.view', 'permission:inbox.manage'])->group(function (): void {
    Route::post('inbox/conversations/{code}/lead', [ConversationCrmController::class, 'lead'])->middleware('permission:crm.leads.manage')->name('inbox.conversations.lead');
    Route::post('inbox/conversations/{code}/activities', [ConversationCrmController::class, 'activity'])->middleware('permission:crm.activities.manage')->name('inbox.conversations.activities');
});
