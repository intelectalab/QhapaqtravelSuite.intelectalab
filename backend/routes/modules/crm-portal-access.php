<?php

declare(strict_types=1);

use App\Domain\Crm\Http\Controllers\ClientController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:crm.clients.manage')->group(function (): void {
    Route::post('crm/clients/{code}/portal-access', [ClientController::class, 'invitePortal'])->name('crm.clients.portal-access.store');
    Route::post('crm/clients/{code}/portal-access/resend', [ClientController::class, 'resendPortal'])->name('crm.clients.portal-access.resend');
    Route::post('crm/clients/{code}/portal-access/revoke', [ClientController::class, 'revokePortal'])->name('crm.clients.portal-access.revoke');
});
