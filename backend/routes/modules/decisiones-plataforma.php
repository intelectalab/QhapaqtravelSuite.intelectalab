<?php

declare(strict_types=1);

use App\Domain\Admin\Http\Controllers\RuleAutomationController;
use Illuminate\Support\Facades\Route;

Route::post('admin/booking-rules/{code}/automation-requests', [RuleAutomationController::class, 'store'])->middleware(['permission:admin.settings.manage', 'throttle:20,1'])->name('decisiones-plataforma.rules.automation-requests.store');
