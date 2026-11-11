<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Http\Controllers;

use App\Domain\Catalog\Actions\ProductPromotions;
use App\Domain\Catalog\Support\PromotionDirectory;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PromotionController
{
    public function __construct(private readonly ProductPromotions $promotions) {}

    public function all(PromotionDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->all()]);
    }

    public function index(string $code, PromotionDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->forProduct($code)]);
    }

    public function store(Request $request, string $code): JsonResponse
    {
        $data = $request->validate(ProductPromotions::rules(true), ProductPromotions::messages());

        return response()->json(['data' => ['ref' => $this->promotions->create($code, $data, $this->user($request))]], 201);
    }

    public function update(Request $request, string $code, string $ref): JsonResponse
    {
        $data = $request->validate(ProductPromotions::rules(false), ProductPromotions::messages());
        $this->promotions->update($code, $ref, $data, $this->user($request));

        return response()->json(['data' => ['ref' => $ref]]);
    }

    public function pause(Request $request, string $code, string $ref): JsonResponse
    {
        $this->promotions->status($code, $ref, 'inactiva', $this->user($request));

        return response()->json(['data' => ['ref' => $ref, 'status' => 'inactiva']]);
    }

    public function activate(Request $request, string $code, string $ref): JsonResponse
    {
        $this->promotions->status($code, $ref, 'activa', $this->user($request));

        return response()->json(['data' => ['ref' => $ref, 'status' => 'activa']]);
    }

    public function activateByRef(Request $request, string $ref): JsonResponse
    {
        $this->promotions->statusByRef($ref, 'activa', $this->user($request));

        return response()->json(['data' => ['ref' => $ref, 'status' => 'activa']]);
    }

    public function deactivateByRef(Request $request, string $ref): JsonResponse
    {
        $this->promotions->statusByRef($ref, 'inactiva', $this->user($request));

        return response()->json(['data' => ['ref' => $ref, 'status' => 'inactiva']]);
    }

    public function destroy(Request $request, string $code, string $ref): JsonResponse
    {
        $this->promotions->delete($code, $ref, $this->user($request));

        return response()->json(null, 204);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
