<?php

declare(strict_types=1);

namespace App\Domain\Operations\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Operations\Actions\SupplierAlternativeReview;
use App\Domain\Operations\Support\SupplierResponseDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class SupplierResponseController
{
    public function index(Request $request, SupplierResponseDirectory $directory): JsonResponse
    {
        $data = $request->validate([
            'filter.type' => ['nullable', Rule::in(['confirmacion', 'rechazo', 'alternativa'])],
            'filter.review_status' => ['nullable', Rule::in(SupplierResponseDirectory::REVIEW)],
            'filter.reservation' => ['nullable', 'string', 'max:30'],
        ], ['filter.*' => 'Revisa los filtros.']);

        return response()->json(['data' => $directory->list($this->user($request), $data['filter'] ?? [])]);
    }

    public function accept(Request $request, string $id, SupplierAlternativeReview $review): JsonResponse
    {
        $data = $request->validate([
            'confirmation_code' => ['nullable', 'string', 'min:4', 'max:40', 'regex:/^[A-Za-z0-9\-\/\.]+$/'],
            'note' => ['nullable', 'string', 'max:500'],
        ], [
            'confirmation_code.*' => 'El código de confirmación tiene al menos 4 caracteres, sin espacios.',
            'note.*' => 'La nota admite hasta 500 caracteres.',
        ]);

        return response()->json(['data' => $review->accept($id, $data, $this->user($request))]);
    }

    public function reject(Request $request, string $id, SupplierAlternativeReview $review): JsonResponse
    {
        $data = $request->validate(['note' => ['required', 'string', 'min:5', 'max:500']], ['note.*' => 'Explica al proveedor por qué no la aceptas (mínimo 5 caracteres).']);

        return response()->json(['data' => $review->reject($id, $data, $this->user($request))]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
