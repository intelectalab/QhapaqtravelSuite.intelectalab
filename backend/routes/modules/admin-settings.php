<?php

declare(strict_types=1);

use App\Domain\Admin\Http\Controllers\NotificationController;
use App\Domain\Admin\Http\Controllers\PaxTemplateController;
use App\Domain\Admin\Http\Controllers\RuleController;
use App\Domain\Admin\Http\Controllers\SettingsController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:admin.settings.manage')->prefix('admin')->name('admin.')->group(function (): void {
    Route::get('settings', [SettingsController::class, 'index'])->name('settings.index');
    Route::patch('settings/sequences/{docType}', [SettingsController::class, 'sequence'])->name('settings.sequence');
    Route::patch('settings/{section}', [SettingsController::class, 'update'])->name('settings.update');

    Route::get('branding', [SettingsController::class, 'branding'])->name('branding.index');
    Route::put('branding', [SettingsController::class, 'saveBranding'])->name('branding.save');
    Route::post('branding/reset', [SettingsController::class, 'resetBranding'])->name('branding.reset');

    Route::get('rules', [RuleController::class, 'index'])->name('rules.index');
    Route::post('rules', [RuleController::class, 'store'])->name('rules.store');
    Route::patch('rules/{code}', [RuleController::class, 'update'])->name('rules.update');
    Route::delete('rules/{code}', [RuleController::class, 'destroy'])->name('rules.destroy');
    Route::post('rules/{code}/toggle', [RuleController::class, 'toggle'])->name('rules.toggle');
    Route::patch('rules/{code}/params', [RuleController::class, 'params'])->name('rules.params');
    Route::post('rules/{code}/reset', [RuleController::class, 'reset'])->name('rules.reset');

    Route::get('pax-templates', [PaxTemplateController::class, 'index'])->name('pax-templates.index');
    Route::post('pax-templates', [PaxTemplateController::class, 'store'])->name('pax-templates.store');
    Route::patch('pax-templates/{code}', [PaxTemplateController::class, 'update'])->name('pax-templates.update');
    Route::post('pax-templates/{code}/toggle', [PaxTemplateController::class, 'toggle'])->name('pax-templates.toggle');
    Route::delete('pax-templates/{code}', [PaxTemplateController::class, 'destroy'])->name('pax-templates.destroy');

    Route::get('notifications', [NotificationController::class, 'index'])->name('notifications.index');
    Route::patch('notifications/rules/{event}', [NotificationController::class, 'rule'])->name('notifications.rule');
    Route::post('notifications/messages/{code}/retry', [NotificationController::class, 'retry'])->name('notifications.retry');
});
