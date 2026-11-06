<?php

declare(strict_types=1);

use App\Domain\Platform\Http\Controllers\PublicSoftwareController;
use Illuminate\Support\Facades\Route;

Route::prefix('software')->name('software.')->group(function (): void {
    Route::get('plans', [PublicSoftwareController::class, 'plans'])->name('plans');
    Route::get('overview', [PublicSoftwareController::class, 'overview'])->name('overview');
});
