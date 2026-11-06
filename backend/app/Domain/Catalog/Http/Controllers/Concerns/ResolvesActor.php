<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Http\Controllers\Concerns;

use App\Domain\Iam\Models\User;
use Illuminate\Http\Request;

trait ResolvesActor
{
    private function actor(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
