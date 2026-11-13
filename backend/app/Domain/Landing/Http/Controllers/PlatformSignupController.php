<?php

declare(strict_types=1);

namespace App\Domain\Landing\Http\Controllers;

use App\Domain\Landing\Support\SignupDirectory;
use Illuminate\Http\JsonResponse;

final class PlatformSignupController
{
    public function index(SignupDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->platform()]);
    }
}
