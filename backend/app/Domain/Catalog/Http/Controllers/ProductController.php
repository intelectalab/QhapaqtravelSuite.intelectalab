<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Http\Controllers;

use App\Domain\Catalog\Support\ProductDirectory;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ProductController
{
    public function __construct(private readonly ProductDirectory $directory)
    {
    }

    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->directory->list()]);
    }

    public function show(Request $request, string $code): JsonResponse
    {
        $user = $request->user();
        assert($user instanceof User);

        return response()->json(['data' => $this->directory->find($code, $user) ?? throw ApiException::notFound('El producto no existe.')]);
    }
}
