<?php

declare(strict_types=1);

use App\Domain\Crm\Http\Controllers\ClientController;
use Illuminate\Support\Facades\Route;

Route::post('crm/clients/{code}/anonymize', [ClientController::class, 'anonymize'])->middleware('permission:crm.clients.manage')->name('crm.clients.anonymize');
