<?php

declare(strict_types=1);

use App\Domain\Operations\Http\Controllers\PaxFeedbackIncidentController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:operations.incidents')
    ->post('pax-feedback/{code}/incident', [PaxFeedbackIncidentController::class, 'store'])
    ->name('pax-feedback.incident');
