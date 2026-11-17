<?php

declare(strict_types=1);

use App\Domain\Admin\Http\Controllers\ApiAccessController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:admin.api.manage')->name('tanda16.llaves.')->group(function (): void {
    Route::patch('integrations/api-keys/{code}/owner', [ApiAccessController::class, 'updateKeyOwner'])->name('owner.update');
});
