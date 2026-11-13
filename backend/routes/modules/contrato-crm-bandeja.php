<?php

declare(strict_types=1);

use App\Domain\Admin\Http\Controllers\PaxTemplatePreviewController;
use App\Domain\Catalog\Http\Controllers\ProductRuleOverrideController;
use App\Domain\Channels\Http\Controllers\PaxFeedbackController;
use App\Domain\Channels\Http\Controllers\WidgetDomainController;
use App\Domain\Crm\Http\Controllers\CrmContractController;
use App\Domain\Finance\Http\Controllers\CurrencyContractController;
use App\Domain\Inbox\Http\Controllers\InboxContractController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:crm.clients.manage')->group(function (): void {
    Route::get('crm/after-sales/trips', [CrmContractController::class, 'trips'])->name('crm.aftersales.trips');
    Route::get('crm/cases', [CrmContractController::class, 'cases'])->name('crm.cases.index');
    Route::get('crm/cases/{code}', [CrmContractController::class, 'showCase'])->name('crm.cases.show');
    Route::get('crm/surveys', [CrmContractController::class, 'surveys'])->name('crm.surveys.index');
    Route::get('crm/clients/duplicates', [CrmContractController::class, 'duplicates'])->name('crm.clients.duplicates');
});

Route::get('crm/pipeline-stages', [CrmContractController::class, 'pipelineStages'])->middleware('permission:crm.opportunities.manage')->name('crm.pipeline-stages.index');

Route::middleware('permission:crm.clients.manage|finance.receivables')->group(function (): void {
    Route::get('crm/clients/{code}/invoices/{id}/preview', [CrmContractController::class, 'invoicePreview'])->name('crm.clients.invoices.preview');
    Route::get('crm/clients/{code}/vouchers/{id}/preview', [CrmContractController::class, 'voucherPreview'])->name('crm.clients.vouchers.preview');
});

Route::post('crm/clients/{code}/reassign', [CrmContractController::class, 'reassign'])->middleware('permission:crm.records.reassign')->name('crm.clients.reassign');

Route::middleware('permission:inbox.manage')->group(function (): void {
    Route::post('pax-feedback/{code}/read', [PaxFeedbackController::class, 'read'])->name('pax-feedback.read');
    Route::post('pax-feedback/{code}/reply', [PaxFeedbackController::class, 'reply'])->name('pax-feedback.reply');
});

Route::middleware('permission:approvals.view')->group(function (): void {
    Route::get('approval-rules', [InboxContractController::class, 'rules'])->name('approvals.rules.index');
    Route::get('approvals/counters', [InboxContractController::class, 'counters'])->name('approvals.counters');
    Route::get('approvals/{code}', [InboxContractController::class, 'show'])->name('approvals.show');
});

Route::get('approvals/cancel-preview/{reservation}', [InboxContractController::class, 'cancelPreview'])->middleware('permission:reservations.cancel')->name('approvals.cancel-preview');

Route::middleware('permission:inbox.view')->group(function (): void {
    Route::get('inbox/templates', [InboxContractController::class, 'templates'])->name('inbox.templates.index');
    Route::post('inbox/templates', [InboxContractController::class, 'storeTemplate'])->middleware('permission:admin.settings.manage')->name('inbox.templates.store');
    Route::patch('inbox/templates/{id}', [InboxContractController::class, 'updateTemplate'])->middleware('permission:admin.settings.manage')->name('inbox.templates.update');
    Route::post('inbox/conversations/{code}/notes', [InboxContractController::class, 'note'])->middleware('permission:inbox.manage')->name('inbox.conversations.notes');
});

Route::get('catalog/products/{product}/rule-overrides/{rule}', [ProductRuleOverrideController::class, 'show'])->middleware('permission:admin.settings.manage')->name('catalog.products.rule-overrides.show');

Route::get('channels/widget/domains', [WidgetDomainController::class, 'index'])->middleware('permission:channels.ecommerce.manage')->name('channels.web.domains.index');

Route::post('notifications/pax-templates/{id}/preview', PaxTemplatePreviewController::class)->middleware('permission:admin.settings.manage|operations.assign')->name('admin.pax-templates.preview');

Route::middleware('permission:admin.settings.manage|finance.treasury')->group(function (): void {
    Route::get('finance/currencies/convert', [CurrencyContractController::class, 'convert'])->middleware('permission:admin.settings.manage')->name('finance.currencies.convert');
    Route::get('finance/currencies/{code}/rates', [CurrencyContractController::class, 'rates'])->name('finance.currencies.rates');
    Route::post('finance/currencies/refresh', [CurrencyContractController::class, 'refresh'])->name('finance.currencies.refresh');
    Route::get('finance/fx-providers', [CurrencyContractController::class, 'providers'])->name('finance.fx-providers.index');
    Route::post('finance/fx-providers/{code}/test', [CurrencyContractController::class, 'testProvider'])->middleware('permission:admin.settings.manage')->name('finance.fx-providers.test');
});
