<?php

declare(strict_types=1);

use App\Domain\Admin\Http\Controllers\PaxTemplateDuplicateController;
use Illuminate\Support\Facades\Route;

Route::post('notifications/pax-templates/{code}/duplicate', PaxTemplateDuplicateController::class)->middleware('permission:admin.settings.manage')->name('brechas-g5.pax-templates.duplicate');
