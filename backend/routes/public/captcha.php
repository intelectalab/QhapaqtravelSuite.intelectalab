<?php

declare(strict_types=1);

use App\Domain\Platform\Http\Controllers\PublicCaptchaController;
use Illuminate\Support\Facades\Route;

Route::get('captcha', PublicCaptchaController::class)->name('captcha.show');
