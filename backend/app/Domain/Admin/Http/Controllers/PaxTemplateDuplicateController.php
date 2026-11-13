<?php

declare(strict_types=1);

namespace App\Domain\Admin\Http\Controllers;

use App\Domain\Admin\Actions\ManagePaxTemplates;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PaxTemplateDuplicateController
{
    public function __invoke(Request $request, string $code, ManagePaxTemplates $templates): JsonResponse
    {
        $user = $request->user();
        assert($user instanceof User);

        return response()->json(['data' => $templates->duplicate($code, $user)], 201);
    }
}
