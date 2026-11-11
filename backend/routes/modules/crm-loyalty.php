<?php

declare(strict_types=1);

use App\Domain\Crm\Http\Controllers\LoyaltyController;
use Illuminate\Support\Facades\Route;

Route::get('crm/loyalty/segments', [LoyaltyController::class, 'index'])->middleware('permission:crm.clients.manage')->name('crm.loyalty.segments');
Route::get('crm/clients/{code}/rebuy-proposal', [LoyaltyController::class, 'proposal'])->middleware('permission:crm.opportunities.manage')->name('crm.clients.rebuy-proposal');
