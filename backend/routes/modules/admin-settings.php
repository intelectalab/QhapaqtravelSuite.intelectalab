<?php

declare(strict_types=1);

use App\Domain\Admin\Http\Controllers\NotificationController;
use App\Domain\Admin\Http\Controllers\PaxTemplateController;
use App\Domain\Admin\Http\Controllers\RuleController;
use App\Domain\Admin\Http\Controllers\SettingsController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:admin.settings.manage')->prefix('admin')->name('admin.')->group(function (): void {
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
});

Route::get('settings/fx-rates', [SettingsController::class, 'fxRates'])->middleware('permission:admin.settings.manage|finance.treasury')->name('settings.fx-rates.index');

Route::middleware('permission:admin.settings.manage')->group(function (): void {
    Route::get('settings', [SettingsController::class, 'index'])->name('settings.index');
    Route::get('settings/sequences', [SettingsController::class, 'sequences'])->name('settings.sequences.index');
    Route::post('settings/sequences', [SettingsController::class, 'storeSequence'])->name('settings.sequences.store');
    Route::patch('settings/sequences', [SettingsController::class, 'updateSequences'])->name('settings.sequences.update');
    Route::patch('settings/{section}', [SettingsController::class, 'update'])->name('settings.update');

    Route::get('notifications/rules', [NotificationController::class, 'rules'])->name('notifications.rules.index');
    Route::patch('notifications/rules/{event}', [NotificationController::class, 'rule'])->name('notifications.rules.update');
    Route::post('notifications/rules/{event}/test', [NotificationController::class, 'testRule'])->name('notifications.rules.test');
    Route::get('notifications/templates/{event}/{channel}', [NotificationController::class, 'template'])->name('notifications.templates.show');
    Route::put('notifications/templates/{event}/{channel}', [NotificationController::class, 'saveTemplate'])->name('notifications.templates.update');
    Route::delete('notifications/templates/{event}/{channel}', [NotificationController::class, 'restoreTemplate'])->name('notifications.templates.destroy');
    Route::post('notifications/templates/{event}/{channel}/test', [NotificationController::class, 'testTemplate'])->name('notifications.templates.test');
    Route::get('notifications/messages', [NotificationController::class, 'messages'])->name('notifications.messages.index');
    Route::post('notifications/messages/retry-failed', [NotificationController::class, 'retryFailed'])->name('notifications.messages.retry-failed');
    Route::post('notifications/messages/{id}/retry', [NotificationController::class, 'retry'])->name('notifications.messages.retry');
    Route::post('notifications/messages/{id}/fallback', [NotificationController::class, 'fallback'])->name('notifications.messages.fallback');
});
