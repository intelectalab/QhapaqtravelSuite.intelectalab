<?php

declare(strict_types=1);

use App\Domain\Marketing\Http\Controllers\CampaignController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:marketing.campaigns.manage')->group(function (): void {
    Route::get('marketing/campaigns', [CampaignController::class, 'index'])->name('marketing.campaigns.index');
    Route::post('marketing/campaigns', [CampaignController::class, 'store'])->name('marketing.campaigns.store');
    Route::patch('marketing/campaigns/{code}', [CampaignController::class, 'update'])->name('marketing.campaigns.update');
    Route::post('marketing/campaigns/{code}/test-send', [CampaignController::class, 'test'])->name('marketing.campaigns.test');
    Route::post('marketing/campaigns/{code}/schedule', [CampaignController::class, 'schedule'])->name('marketing.campaigns.schedule');
    Route::post('marketing/campaigns/{code}/unschedule', [CampaignController::class, 'unschedule'])->name('marketing.campaigns.unschedule');
    Route::post('marketing/campaigns/{code}/cancel', [CampaignController::class, 'cancel'])->name('marketing.campaigns.cancel');
    Route::post('marketing/campaigns/{code}/send', [CampaignController::class, 'send'])->middleware(['idempotent', 'if-match:mkt_campaigns,code,code'])->name('marketing.campaigns.send');
    Route::post('marketing/campaigns/{code}/duplicate', [CampaignController::class, 'duplicate'])->name('marketing.campaigns.duplicate');
});
