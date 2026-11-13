<?php

declare(strict_types=1);

use App\Domain\Catalog\Http\Controllers\ProductSubresourceController;
use Illuminate\Support\Facades\Route;

Route::controller(ProductSubresourceController::class)->group(function (): void {
    Route::middleware('permission:catalog.products.view')->group(function (): void {
        Route::get('catalog/products/kpis', 'kpis')->name('contrato.catalog.products.kpis');
        Route::get('catalog/products/export', 'export')->middleware('throttle:exports')->name('contrato.catalog.products.export');
        Route::get('catalog/products/{id}/usage', 'usage')->name('contrato.catalog.products.usage');
        Route::get('catalog/products/{id}/content', 'content')->name('contrato.catalog.products.content.show');
        Route::get('catalog/products/{id}/components', 'components')->name('contrato.catalog.products.components.index');
        Route::get('catalog/products/{id}/itineraries', 'itineraries')->name('contrato.catalog.products.itineraries.index');
        Route::get('catalog/products/{id}/policies', 'policies')->name('contrato.catalog.products.policies.show');
        Route::get('catalog/products/{id}/inclusions', 'inclusions')->name('contrato.catalog.products.inclusions.index');
        Route::get('catalog/products/{id}/related', 'related')->name('contrato.catalog.products.related.index');
        Route::get('catalog/products/{id}/config-groups', 'configGroups')->name('contrato.catalog.products.config-groups.index');
        Route::get('catalog/products/{id}/channels', 'channels')->name('contrato.catalog.products.channels.index');
    });

    Route::get('catalog/products/{id}/audit', 'audit')->middleware('permission:catalog.products.update|catalog.products.view_profitability|admin.audit.view')->name('contrato.catalog.products.audit');

    Route::middleware('permission:catalog.products.update')->group(function (): void {
        Route::post('catalog/products/{id}/requirements', 'storeRequirement')->name('contrato.catalog.products.requirements.store');
        Route::delete('catalog/products/{id}/requirements/{reqId}', 'destroyRequirement')->name('contrato.catalog.products.requirements.destroy');
        Route::post('catalog/products/{id}/inclusions', 'storeInclusion')->name('contrato.catalog.products.inclusions.store');
        Route::delete('catalog/products/{id}/inclusions/{incId}', 'destroyInclusion')->name('contrato.catalog.products.inclusions.destroy');
        Route::post('catalog/products/{id}/faqs', 'storeFaq')->name('contrato.catalog.products.faqs.store');
        Route::delete('catalog/products/{id}/faqs/{faqId}', 'destroyFaq')->name('contrato.catalog.products.faqs.destroy');
        Route::post('catalog/products/{id}/media', 'storeMedia')->name('contrato.catalog.products.media.store');
        Route::patch('catalog/products/{id}/media/{mediaId}', 'updateMedia')->name('contrato.catalog.products.media.update');
        Route::delete('catalog/products/{id}/media/{mediaId}', 'destroyMedia')->name('contrato.catalog.products.media.destroy');
        Route::post('catalog/products/{id}/related', 'storeRelated')->name('contrato.catalog.products.related.store');
        Route::delete('catalog/products/{id}/related/{relId}', 'destroyRelated')->name('contrato.catalog.products.related.destroy');
        Route::post('catalog/products/{id}/config-groups', 'storeConfigGroup')->name('contrato.catalog.products.config-groups.store');
        Route::delete('catalog/products/{id}/config-groups/{groupId}', 'destroyConfigGroup')->name('contrato.catalog.products.config-groups.destroy');
        Route::post('catalog/products/{id}/components/reorder', 'reorderComponents')->name('contrato.catalog.products.components.reorder');
    });

    Route::put('catalog/products/{id}/markup', 'markup')->middleware('permission:catalog.products.manage_rates')->name('contrato.catalog.products.markup');
});
