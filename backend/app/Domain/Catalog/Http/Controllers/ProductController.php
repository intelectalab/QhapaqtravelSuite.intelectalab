<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Http\Controllers;

use App\Domain\Catalog\Actions\ProductWorkflow;
use App\Domain\Catalog\Http\Requests\ProductSaveRequest;
use App\Domain\Catalog\Support\ProductChecklist;
use App\Domain\Catalog\Support\ProductDirectory;
use App\Domain\Catalog\Support\ProductOptions;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class ProductController
{
    public function __construct(private readonly ProductDirectory $directory, private readonly ProductWorkflow $workflow) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->directory->list($this->user($request))]);
    }

    public function show(Request $request, string $code): JsonResponse
    {
        return response()->json(['data' => $this->directory->find($code, $this->user($request)) ?? throw ApiException::notFound('El producto no existe.')]);
    }

    public function formOptions(Request $request, ProductOptions $options): JsonResponse
    {
        return response()->json(['data' => $options->all($this->user($request))]);
    }

    public function checklist(string $code, ProductChecklist $checklist): JsonResponse
    {
        $product = DB::table('catalog_products')->where('code', $code)->whereNull('deleted_at')->first() ?? throw ApiException::notFound('El producto no existe.');

        return response()->json(['data' => $checklist->evaluate($product)]);
    }

    public function store(ProductSaveRequest $request): JsonResponse
    {
        return response()->json(['data' => ['code' => $this->workflow->create($request->validated(), $this->user($request))]], 201);
    }

    public function update(ProductSaveRequest $request, string $code): JsonResponse
    {
        $next = $this->workflow->update($code, $request->validated(), (int) $request->input('lock_version'), $this->user($request));

        return response()->json(['data' => ['code' => $next]]);
    }

    public function minimumPassengers(Request $request, string $code): JsonResponse
    {
        $data = $request->validate(['minimum_passengers' => ['required', 'integer', 'min:1', 'max:999'], 'lock_version' => ['required', 'integer']], ['minimum_passengers.*' => 'Escribe el mínimo de pasajeros (1 o más).']);

        return response()->json(['data' => $this->workflow->minimumPassengers($code, (int) $data['minimum_passengers'], (int) $data['lock_version'], $this->user($request))]);
    }

    public function transition(Request $request, string $code, string $action): JsonResponse
    {
        $request->validate(['reason' => ['nullable', 'string', 'max:500'], 'lock_version' => ['required', 'integer']]);
        $this->workflow->transition($code, $action, $request->input('reason'), (int) $request->input('lock_version'), $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function destroy(Request $request, string $code): JsonResponse
    {
        $request->validate(['reason' => ['required', 'string', 'min:3', 'max:500']], ['reason.required' => 'Escribe el motivo.']);
        $this->workflow->delete($code, (string) $request->input('reason'), $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
