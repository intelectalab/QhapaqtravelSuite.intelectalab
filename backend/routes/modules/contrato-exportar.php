<?php

declare(strict_types=1);

use App\Domain\Crm\Http\Controllers\CrmExportController;
use Illuminate\Support\Facades\Route;

Route::post('exports', [CrmExportController::class, 'store'])->middleware('throttle:20,1')->name('contrato-exportar.exports.store');
