<?php

declare(strict_types=1);

use App\Domain\Platform\Http\Controllers\DemoRequestController;
use Illuminate\Support\Facades\Route;

Route::get('demo-requests', [DemoRequestController::class, 'index'])->name('demo-requests.index');
Route::patch('demo-requests/{code}', [DemoRequestController::class, 'update'])->middleware('platform.user:verified,admin.tenant.manage')->name('demo-requests.update');
