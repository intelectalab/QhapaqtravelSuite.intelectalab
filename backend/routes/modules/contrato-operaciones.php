<?php

declare(strict_types=1);

use App\Domain\Operations\Http\Controllers\FollowUpContractController;
use App\Domain\Operations\Http\Controllers\OrderContractController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:operations.view')->prefix('ops')->name('ops.contract.')->group(function (): void {
    Route::controller(OrderContractController::class)->group(function (): void {
        Route::get('orders/kpis', 'kpis')->name('orders.kpis');
        Route::get('orders/candidates', 'candidates')->middleware('permission:operations.assign')->name('orders.candidates');
        Route::get('orders/{id}/close-checks', 'closeChecks')->name('orders.close-checks');
        Route::get('orders/{id}/cost-summary', 'costSummary')->name('orders.cost-summary');
        Route::get('assignments', 'assignments')->name('assignments.index');
        Route::get('resources/document-alerts', 'documentAlerts')->name('resources.document-alerts');
        Route::get('resources/{type}/{id}/agenda', 'agenda')->name('resources.agenda');
        Route::get('supplier-requests', 'supplierRequests')->name('supplier-requests.index');

        Route::middleware('permission:operations.assign')->group(function (): void {
            Route::patch('orders/{id}/coordinator', 'coordinator')->name('orders.coordinator');
            Route::post('orders/{id}/assignments', 'createAssignment')->name('orders.assignments.store');
            Route::patch('resources/{type}/{id}/status', 'resourceStatus')->name('resources.status');
            Route::post('reservation-services/{id}/supplier-request', 'supplierRequest')->name('reservation-services.supplier-request');
            Route::post('reservation-services/{id}/supplier-confirmation', 'supplierConfirmation')->name('reservation-services.supplier-confirmation');
            Route::post('reservation-services/{id}/supplier-rejection', 'supplierRejection')->name('reservation-services.supplier-rejection');
        });
    });

    Route::controller(FollowUpContractController::class)->group(function (): void {
        Route::get('rooming-lists/{id}', 'rooming')->name('rooming.show');
        Route::get('rooming-lists/{id}/document', 'roomingDocument')->name('rooming.document');
        Route::get('vouchers/pending-issue', 'pendingVouchers')->name('vouchers.pending-issue');
        Route::get('vouchers/{id}', 'voucher')->name('vouchers.show');

        Route::middleware('permission:reservations.modify')->group(function (): void {
            Route::post('rooming-lists/{id}/validate', 'validateRooming')->name('rooming.validate');
            Route::put('rooming-rooms/{id}', 'replaceRoom')->name('rooming-rooms.replace');
            Route::delete('rooming-rooms/{id}', 'deleteRoom')->name('rooming-rooms.destroy');
        });

        Route::middleware('permission:operations.vouchers')->group(function (): void {
            Route::post('vouchers/check', 'checkVoucher')->name('vouchers.check');
            Route::post('vouchers/{id}/resend', 'resendVoucher')->name('vouchers.resend');
        });

        Route::middleware('permission:operations.incidents')->group(function (): void {
            Route::patch('incidents/{id}/assignee', 'incidentAssignee')->name('incidents.assignee');
            Route::patch('incidents/{id}/classification', 'incidentClassification')->name('incidents.classification');
        });
    });
});
