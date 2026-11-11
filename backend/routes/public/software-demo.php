<?php

declare(strict_types=1);

use App\Domain\Platform\Http\Controllers\PublicSoftwareController;
use Illuminate\Support\Facades\Route;

Route::prefix('software')->name('software.')->group(function (): void {
    Route::get('demo-requests/options', [PublicSoftwareController::class, 'demoOptions'])->name('demo-requests.options');
    Route::post('demo-requests', [PublicSoftwareController::class, 'requestDemo'])->middleware('captcha')->name('demo-requests.store');
});
