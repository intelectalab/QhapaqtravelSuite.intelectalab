<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Http\Controllers;

use App\Domain\Catalog\Actions\RateRegistry;
use App\Domain\Catalog\Actions\SeasonRegistry;
use App\Domain\Catalog\Http\Controllers\Concerns\ResolvesActor;
use App\Domain\Catalog\Support\CatalogAccess;
use App\Domain\Catalog\Support\RateDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class RateController
{
    use ResolvesActor;

    public function __construct(private readonly RateRegistry $rates, private readonly SeasonRegistry $seasons) {}

    public function index(Request $request, RateDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->actor($request))]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateRate($request, true);

        return response()->json(['data' => $this->rates->create($data, $this->actor($request))], 201);
    }

    public function update(Request $request, string $ref): JsonResponse
    {
        $data = $this->validateRate($request, false);

        return response()->json(['data' => $this->rates->update($ref, $data, (int) $request->input('lock_version'), $this->actor($request))]);
    }

    public function activate(Request $request, string $ref): JsonResponse
    {
        $this->rates->setActive($ref, true, null, $this->actor($request));

        return response()->json(['data' => ['ref' => $ref]]);
    }

    public function deactivate(Request $request, string $ref): JsonResponse
    {
        $request->validate(['reason' => ['required', 'string', 'min:3', 'max:300']], ['reason.*' => 'Escribe el motivo.']);
        $this->rates->setActive($ref, false, (string) $request->input('reason'), $this->actor($request));

        return response()->json(['data' => ['ref' => $ref]]);
    }

    public function storeSeason(Request $request): JsonResponse
    {
        return response()->json(['data' => ['ref' => $this->seasons->create($this->validateSeason($request), $this->actor($request))]], 201);
    }

    public function updateSeason(Request $request, string $ref): JsonResponse
    {
        return response()->json(['data' => ['ref' => $this->seasons->update($ref, $this->validateSeason($request), $this->actor($request))]]);
    }

    public function activateSeason(Request $request, string $ref): JsonResponse
    {
        $this->seasons->setActive($ref, true, $this->actor($request));

        return response()->json(['data' => ['ref' => $ref]]);
    }

    public function deactivateSeason(Request $request, string $ref): JsonResponse
    {
        $this->seasons->setActive($ref, false, $this->actor($request));

        return response()->json(['data' => ['ref' => $ref]]);
    }

    private function validateRate(Request $request, bool $creating): array
    {
        return $request->validate([
            'product_id' => [Rule::requiredIf($creating), 'uuid'],
            'rate_type' => ['required', Rule::in(RateDirectory::TYPES)],
            'segment' => ['required', Rule::in(RateDirectory::SEGMENTS)],
            'channel' => ['required', Rule::in(RateDirectory::CHANNELS)],
            'currency' => ['required', Rule::in(CatalogAccess::CURRENCIES)],
            'price_basis' => ['nullable', Rule::in(RateDirectory::BASES)],
            'cost' => ['required', 'numeric', 'min:0', 'max:999999'],
            'price' => ['required', 'numeric', 'gt:0', 'max:999999'],
            'min_price' => ['nullable', 'numeric', 'gt:0'],
            'max_price' => ['nullable', 'numeric', 'gt:0'],
            'valid_from' => ['required', 'date'],
            'valid_to' => ['required', 'date', 'after_or_equal:valid_from'],
            'season_id' => ['nullable', 'uuid'],
            'conditions' => ['nullable', 'string', 'max:300'],
            'reason' => ['nullable', 'string', 'max:300'],
            'lock_version' => [Rule::requiredIf(! $creating), 'integer'],
        ], [
            'product_id.*' => 'Elige el producto.',
            'rate_type.*' => 'Elige el tipo de tarifa.',
            'segment.*' => 'Elige el segmento.',
            'channel.*' => 'Elige el canal.',
            'currency.*' => 'Elige la moneda (PRD-BR-004).',
            'price_basis.*' => 'Elige cómo se cobra.',
            'cost.*' => 'El costo debe ser cero o mayor.',
            'price.*' => 'El precio debe ser mayor que cero.',
            'min_price.*' => 'Revisa el precio mínimo.',
            'max_price.*' => 'Revisa el precio máximo.',
            'valid_from.*' => 'Indica desde cuándo rige (PRD-BR-004).',
            'valid_to.after_or_equal' => 'La vigencia debe terminar después de empezar.',
            'valid_to.*' => 'Indica hasta cuándo rige (PRD-BR-004).',
            'season_id.*' => 'Elige una temporada válida.',
            'conditions.*' => 'Las condiciones admiten hasta 300 caracteres.',
            'reason.*' => 'El motivo admite hasta 300 caracteres.',
            'lock_version.*' => 'Recarga la página e inténtalo de nuevo.',
        ]);
    }

    private function validateSeason(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:120'],
            'type' => ['required', Rule::in(RateDirectory::SEASON_TYPES)],
            'date_from' => ['required', 'date'],
            'date_to' => ['required', 'date', 'after_or_equal:date_from'],
            'priority' => ['required', 'integer', 'min:0', 'max:99'],
            'factor' => ['required', 'numeric', 'min:0.01', 'max:3'],
            'status' => ['nullable', Rule::in(['activa', 'inactiva'])],
        ], [
            'name.*' => 'Escribe un nombre de al menos 3 caracteres.',
            'type.*' => 'Elige el tipo de temporada.',
            'date_from.*' => 'Indica la fecha de inicio.',
            'date_to.after_or_equal' => 'La temporada debe terminar después de empezar.',
            'date_to.*' => 'Indica la fecha de fin.',
            'priority.*' => 'La prioridad va de 0 a 99; 0 es la que más pesa.',
            'factor.*' => 'El factor va de 0.01 a 3.00 (CAT-BR-17).',
            'status.*' => 'Elige el estado.',
        ]);
    }
}
