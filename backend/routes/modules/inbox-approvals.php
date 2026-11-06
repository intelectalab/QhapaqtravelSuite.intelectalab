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
    Route::patch('approval-rules/{code}', [ApprovalController::class, 'updateRule'])->middleware('permission:admin.settings.manage')->name('approvals.rules.update');
});
