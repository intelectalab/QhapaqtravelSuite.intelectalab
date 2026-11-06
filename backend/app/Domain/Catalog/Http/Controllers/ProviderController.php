<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Http\Controllers;

use App\Domain\Catalog\Actions\ProviderRegistry;
use App\Domain\Catalog\Http\Controllers\Concerns\ResolvesActor;
use App\Domain\Catalog\Support\CatalogAccess;
use App\Domain\Catalog\Support\ProviderDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class ProviderController
{
    use ResolvesActor;

    public function __construct(private readonly ProviderRegistry $registry) {}

    public function index(Request $request, ProviderDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->actor($request))]);
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(['data' => ['ref' => $this->registry->create($this->validated($request), $this->actor($request))]], 201);
    }

    public function update(Request $request, string $ref): JsonResponse
    {
        return response()->json(['data' => ['ref' => $this->registry->update($ref, $this->validated($request), $this->actor($request))]]);
    }

    public function activate(Request $request, string $ref): JsonResponse
    {
        return response()->json(['data' => $this->registry->setActive($ref, true, null, $this->actor($request))]);
    }

    public function deactivate(Request $request, string $ref): JsonResponse
    {
        $request->validate(['reason' => ['required', 'string', 'min:3', 'max:300']], ['reason.*' => 'Escribe el motivo.']);

        return response()->json(['data' => $this->registry->setActive($ref, false, (string) $request->input('reason'), $this->actor($request))]);
    }

    public function storeContact(Request $request, string $ref): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:120'],
            'role' => ['nullable', 'string', 'max:80'],
            'phone' => ['nullable', 'string', 'max:40'],
            'email' => ['nullable', 'email', 'max:160'],
        ], [
            'name.*' => 'Escribe el nombre del contacto.',
            'role.*' => 'El cargo admite hasta 80 caracteres.',
            'phone.*' => 'El teléfono admite hasta 40 caracteres.',
            'email.*' => 'Revisa el correo.',
        ]);
        $this->registry->addContact($ref, $data, $this->actor($request));

        return response()->json(['data' => ['ref' => $ref]], 201);
    }

    public function destroyContact(string $ref, string $contact): JsonResponse
    {
        $this->registry->removeContact($ref, $contact);

        return response()->json(['data' => ['ref' => $ref]]);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:160'],
            'type' => ['required', Rule::in(ProviderDirectory::TYPES)],
            'ruc' => ['required', 'regex:/^(10|15|17|20)\d{9}$/'],
            'city' => ['nullable', 'string', 'max:80'],
            'stars' => ['nullable', 'integer', 'between:0,5'],
            'contact_name' => ['required', 'string', 'min:3', 'max:120'],
            'phone' => ['nullable', 'string', 'max:40'],
            'email' => ['nullable', 'email', 'max:160'],
            'contract_start' => ['required', 'date'],
            'contract_end' => ['required', 'date', 'after_or_equal:contract_start'],
            'currency' => ['required', Rule::in(CatalogAccess::CURRENCIES)],
            'payment_terms' => ['nullable', 'string', 'max:120'],
            'rating' => ['nullable', 'numeric', 'between:1,5'],
            'rating_note' => ['nullable', 'string', 'max:500'],
        ], [
            'name.*' => 'Escribe la razón social.',
            'type.*' => 'Elige el tipo de proveedor.',
            'ruc.*' => 'El RUC tiene 11 dígitos y empieza en 10, 15, 17 o 20.',
            'city.*' => 'La ciudad admite hasta 80 caracteres.',
            'stars.*' => 'Las estrellas van de 0 a 5.',
            'contact_name.*' => 'Escribe el nombre del contacto principal.',
            'phone.*' => 'El teléfono admite hasta 40 caracteres.',
            'email.*' => 'Revisa el correo.',
            'contract_start.*' => 'Indica el inicio del contrato.',
            'contract_end.after_or_equal' => 'El contrato debe terminar después de empezar.',
            'contract_end.*' => 'Indica el fin del contrato.',
            'currency.*' => 'Elige la moneda del contrato.',
            'payment_terms.*' => 'Las condiciones de pago admiten hasta 120 caracteres.',
            'rating.*' => 'La calificación va de 1 a 5.',
            'rating_note.*' => 'La nota admite hasta 500 caracteres.',
        ]);
    }
}
