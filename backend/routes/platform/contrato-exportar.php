<?php

declare(strict_types=1);

use App\Domain\Platform\Http\Controllers\PlatformTrialController;
use Illuminate\Support\Facades\Route;

Route::post('trials', [PlatformTrialController::class, 'store'])->middleware('platform.user:verified,admin.tenant.manage')->name('contrato-exportar.trials.store');
