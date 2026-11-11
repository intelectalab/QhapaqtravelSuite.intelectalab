<?php

declare(strict_types=1);

use App\Domain\Inbox\Http\Controllers\ApprovalController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:approvals.view')->group(function (): void {
    Route::get('approvals', [ApprovalController::class, 'index'])->name('approvals.index');
    Route::post('approvals', [ApprovalController::class, 'store'])->name('approvals.store');
    Route::patch('approvals/{code}', [ApprovalController::class, 'update'])->name('approvals.update');
    Route::post('approvals/{code}/withdraw', [ApprovalController::class, 'withdraw'])->name('approvals.withdraw');
    Route::post('approvals/{code}/approve', [ApprovalController::class, 'approve'])->name('approvals.approve');
    Route::post('approvals/{code}/reject', [ApprovalController::class, 'reject'])->name('approvals.reject');
    Route::post('approvals/{code}/delegate', [ApprovalController::class, 'delegate'])->name('approvals.delegate');
    Route::post('approvals/{code}/info-requests', [ApprovalController::class, 'askInfo'])->name('approvals.info-requests.store');
    Route::post('approvals/{code}/info-requests/{info}/answer', [ApprovalController::class, 'answerInfo'])->whereUuid('info')->name('approvals.info-requests.answer');
    Route::post('approvals/{code}/resubmit', [ApprovalController::class, 'resubmit'])->name('approvals.resubmit');
    Route::middleware('permission:admin.settings.manage')->group(function (): void {
        Route::post('approval-rules', [ApprovalController::class, 'storeRule'])->name('approvals.rules.store');
        Route::post('approval-rules/reset', [ApprovalController::class, 'resetRules'])->name('approvals.rules.reset');
        Route::patch('approval-rules/{code}', [ApprovalController::class, 'updateRule'])->name('approvals.rules.update');
        Route::delete('approval-rules/{code}', [ApprovalController::class, 'destroyRule'])->name('approvals.rules.destroy');
    });
});
