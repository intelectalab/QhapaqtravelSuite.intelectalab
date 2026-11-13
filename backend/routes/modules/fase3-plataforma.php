<?php

declare(strict_types=1);

use App\Domain\Admin\Http\Controllers\OAuthAppController;
use App\Domain\Admin\Http\Controllers\PlatformInvoicePdfController;
use App\Domain\Admin\Http\Controllers\WebhookDeliveryLogController;
use App\Domain\Channels\Http\Controllers\ReviewSourceController;
use App\Domain\Crm\Http\Controllers\SalesTargetController;
use App\Domain\Crm\Http\Controllers\SalesTeamController;
use App\Domain\Marketing\Http\Controllers\CampaignController;
use App\Domain\Marketing\Http\Controllers\CampaignDetailController;
use Illuminate\Support\Facades\Route;

Route::name('plataforma.')->group(function (): void {
    Route::middleware('permission:admin.api.manage')->group(function (): void {
        Route::get('integrations/oauth-apps', [OAuthAppController::class, 'index'])->name('oauth-apps.index');
        Route::post('integrations/oauth-apps', [OAuthAppController::class, 'store'])->name('oauth-apps.store');
        Route::post('integrations/oauth-apps/{id}/secret', [OAuthAppController::class, 'rotate'])->name('oauth-apps.secret');
        Route::delete('integrations/oauth-apps/{id}', [OAuthAppController::class, 'destroy'])->name('oauth-apps.destroy');
        Route::get('integrations/webhook-deliveries', [WebhookDeliveryLogController::class, 'index'])->name('webhook-deliveries.index');
    });

    Route::get('billing/invoices/{number}/pdf', PlatformInvoicePdfController::class)->middleware('permission:admin.billing.manage')->name('billing.invoices.pdf');

    Route::get('crm/sales-targets/ranking', [SalesTeamController::class, 'ranking'])->middleware('permission:crm.targets.view|crm.targets.manage')->name('targets.ranking');
    Route::post('crm/sales-targets/{code}/adjust', [SalesTargetController::class, 'update'])->middleware('permission:crm.targets.manage')->name('targets.adjust');
    Route::get('crm/sales-teams', [SalesTeamController::class, 'teams'])->middleware('permission:crm.targets.manage|admin.settings.manage')->name('teams.index');
    Route::put('crm/sales-teams', [SalesTeamController::class, 'saveTeams'])->middleware('permission:crm.targets.manage')->name('teams.replace');
    Route::get('crm/sales-target-policy', [SalesTeamController::class, 'policy'])->middleware('permission:crm.targets.manage|admin.settings.manage')->name('targets.policy.show');
    Route::put('crm/sales-target-policy', [SalesTeamController::class, 'savePolicy'])->middleware('permission:admin.settings.manage')->name('targets.policy.replace');

    Route::middleware('permission:marketing.campaigns.manage')->group(function (): void {
        Route::get('marketing/campaigns/{code}', [CampaignDetailController::class, 'show'])->name('campaigns.show');
        Route::put('marketing/campaigns/{code}', [CampaignController::class, 'update'])->name('campaigns.replace');
        Route::get('marketing/campaigns/{code}/audience', [CampaignDetailController::class, 'audience'])->name('campaigns.audience');
        Route::get('marketing/campaigns/{code}/recipients', [CampaignDetailController::class, 'recipients'])->name('campaigns.recipients.index');
        Route::post('marketing/campaigns/{code}/recipients/{id}/unsubscribe', [CampaignDetailController::class, 'unsubscribe'])->name('campaigns.recipients.unsubscribe');
    });

    Route::middleware('permission:admin.settings.manage')->group(function (): void {
        Route::get('integrations/review-sources', [ReviewSourceController::class, 'index'])->name('review-sources.index');
        Route::post('integrations/review-sources', [ReviewSourceController::class, 'store'])->name('review-sources.store');
        Route::delete('integrations/review-sources/{provider}', [ReviewSourceController::class, 'destroy'])->name('review-sources.destroy');
        Route::post('integrations/review-sources/{provider}/sync', [ReviewSourceController::class, 'sync'])->middleware('throttle:10,1')->name('review-sources.sync');
    });

    Route::middleware('permission:channels.ecommerce.manage|crm.clients.manage')->group(function (): void {
        Route::post('channels/external-reviews/{id}/reply', [ReviewSourceController::class, 'reply'])->name('external-reviews.reply');
        Route::post('channels/external-reviews/{id}/escalate', [ReviewSourceController::class, 'escalate'])->name('external-reviews.escalate');
        Route::post('reservations/{id}/review-invitations', [ReviewSourceController::class, 'invite'])->name('reservations.review-invitations');
    });
});
