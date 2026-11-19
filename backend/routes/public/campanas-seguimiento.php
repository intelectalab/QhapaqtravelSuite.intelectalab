<?php

declare(strict_types=1);

use App\Domain\Marketing\Http\Controllers\PublicCampaignTrackingController;
use Illuminate\Support\Facades\Route;

Route::controller(PublicCampaignTrackingController::class)->name('campaigns.tracking.')->group(function (): void {
    Route::get('campaigns/open/{token}', 'open')->name('open');
    Route::get('campaigns/click/{token}', 'click')->name('click');
});
