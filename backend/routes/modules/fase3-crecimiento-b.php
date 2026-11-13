<?php

declare(strict_types=1);

use App\Domain\Growth\Http\Controllers\AssistantController;
use App\Domain\Growth\Http\Controllers\CatalogImportController;
use App\Domain\Growth\Http\Controllers\DynamicPriceRuleController;
use App\Domain\Growth\Http\Controllers\MarketplaceController;
use App\Domain\Growth\Http\Controllers\OtaChannelController;
use App\Domain\Growth\Http\Controllers\RecoveryFlowController;
use App\Domain\Growth\Http\Controllers\WhatsappTemplateController;
use Illuminate\Support\Facades\Route;

Route::name('crecimiento-b.')->group(function (): void {
    Route::middleware('permission:ai.assistant.use')->controller(AssistantController::class)->group(function (): void {
        Route::post('ai/requests', 'store')->name('ai.requests.store');
        Route::get('ai/requests/{id}', 'show')->name('ai.requests.show');
        Route::post('ai/requests/{id}/apply', 'apply')->name('ai.requests.apply');
        Route::post('ai/requests/{id}/discard', 'discard')->name('ai.requests.discard');
        Route::get('ai/usage', 'usage')->name('ai.usage');
    });

    Route::middleware('permission:inbox.whatsapp.manage')->controller(WhatsappTemplateController::class)->group(function (): void {
        Route::get('inbox/whatsapp-templates', 'index')->name('inbox.whatsapp-templates.index');
        Route::post('inbox/whatsapp-templates', 'store')->name('inbox.whatsapp-templates.store');
        Route::patch('inbox/whatsapp-templates/{id}', 'update')->name('inbox.whatsapp-templates.update');
    });

    Route::post('inbox/conversations/{code}/send-template', [WhatsappTemplateController::class, 'send'])->middleware('permission:inbox.manage')->name('inbox.conversations.send-template');

    Route::middleware('permission:marketing.campaigns.manage')->controller(RecoveryFlowController::class)->group(function (): void {
        Route::get('marketing/recovery-flows', 'index')->name('marketing.recovery-flows.index');
        Route::post('marketing/recovery-flows', 'store')->name('marketing.recovery-flows.store');
        Route::patch('marketing/recovery-flows/{code}', 'update')->name('marketing.recovery-flows.update');
        Route::get('marketing/recovery-attempts', 'attempts')->name('marketing.recovery-attempts.index');
    });

    Route::middleware('permission:catalog.products.import')->controller(CatalogImportController::class)->group(function (): void {
        Route::get('catalog/imports', 'index')->name('catalog.imports.index');
        Route::post('catalog/imports', 'store')->name('catalog.imports.store');
        Route::get('catalog/imports/{code}', 'show')->name('catalog.imports.show');
        Route::post('catalog/imports/{code}/confirm', 'confirm')->name('catalog.imports.confirm');
        Route::post('catalog/imports/{code}/cancel', 'cancel')->name('catalog.imports.cancel');
    });

    Route::middleware('permission:catalog.products.dynamic_pricing')->controller(DynamicPriceRuleController::class)->group(function (): void {
        Route::get('catalog/dynamic-price-rules', 'index')->name('catalog.dynamic-price-rules.index');
        Route::post('catalog/dynamic-price-rules', 'store')->name('catalog.dynamic-price-rules.store');
        Route::post('catalog/dynamic-price-rules/simulate', 'simulate')->name('catalog.dynamic-price-rules.simulate');
        Route::patch('catalog/dynamic-price-rules/{code}', 'update')->name('catalog.dynamic-price-rules.update');
    });

    Route::middleware('permission:channels.ota.manage')->controller(OtaChannelController::class)->group(function (): void {
        Route::get('channels/ota/connections', 'index')->name('channels.ota.connections.index');
        Route::post('channels/ota/connections', 'store')->name('channels.ota.connections.store');
        Route::patch('channels/ota/connections/{code}', 'update')->name('channels.ota.connections.update');
        Route::post('channels/ota/connections/{code}/sync', 'sync')->name('channels.ota.connections.sync');
        Route::get('channels/ota/connections/{code}/mappings', 'mappings')->name('channels.ota.mappings.index');
        Route::put('channels/ota/connections/{code}/mappings/{productId}', 'map')->name('channels.ota.mappings.replace');
        Route::get('channels/ota/bookings', 'bookings')->name('channels.ota.bookings.index');
    });

    Route::middleware('permission:channels.marketplace.manage')->controller(MarketplaceController::class)->group(function (): void {
        Route::get('marketplace/listings', 'listings')->name('marketplace.listings.index');
        Route::post('marketplace/listings', 'publish')->name('marketplace.listings.store');
        Route::patch('marketplace/listings/{id}', 'updateListing')->name('marketplace.listings.update');
        Route::get('marketplace/partnerships', 'partnerships')->name('marketplace.partnerships.index');
        Route::post('marketplace/partnerships', 'requestPartnership')->name('marketplace.partnerships.store');
        Route::post('marketplace/partnerships/{id}/decide', 'decide')->name('marketplace.partnerships.decide');
        Route::get('marketplace/orders', 'orders')->name('marketplace.orders.index');
        Route::post('marketplace/orders', 'sell')->name('marketplace.orders.store');
    });
});
