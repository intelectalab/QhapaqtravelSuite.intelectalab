<?php

declare(strict_types=1);

use App\Domain\Platform\Http\Controllers\RuleAutomationInboxController;
use Illuminate\Support\Facades\Route;

Route::middleware('platform.user:verified,admin.tenant.manage')->controller(RuleAutomationInboxController::class)->name('decisiones-plataforma.')->group(function (): void {
    Route::get('rule-requests', 'index')->name('rule-requests.index');
    Route::post('rule-requests/{code}/decision', 'decide')->name('rule-requests.decide');
});
