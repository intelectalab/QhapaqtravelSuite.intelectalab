<?php

declare(strict_types=1);

use App\Domain\Reports\Http\Controllers\DashboardController;
use Illuminate\Support\Facades\Route;

Route::get('dashboard/executive', [DashboardController::class, 'executive'])->middleware(['permission:reports.view', 'permission:finance.profitability'])->name('dashboard.executive');
Route::get('dashboard/manager', [DashboardController::class, 'manager'])->middleware('permission:quotes.approve_internal|approvals.view')->name('dashboard.manager');
Route::get('dashboard/sales', [DashboardController::class, 'sales'])->middleware('permission:crm.leads.view')->name('dashboard.sales');
Route::get('finance/dashboards/finance', [DashboardController::class, 'finance'])->middleware('permission:finance.receivables')->name('finance.dashboards.finance');
Route::get('finance/dashboards/accounting', [DashboardController::class, 'accounting'])->middleware('permission:finance.invoicing')->name('finance.dashboards.accounting');
