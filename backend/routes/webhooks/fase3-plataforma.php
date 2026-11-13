<?php

declare(strict_types=1);

use App\Domain\Shared\Http\Controllers\OpenApiController;
use Illuminate\Support\Facades\Route;

Route::get('docs/openapi.json', OpenApiController::class)->middleware('throttle:public')->name('plataforma.docs.openapi');
