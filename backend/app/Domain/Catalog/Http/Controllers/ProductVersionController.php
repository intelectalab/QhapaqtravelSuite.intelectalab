<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Http\Controllers;

use App\Domain\Catalog\Actions\ProductVersions;
use App\Domain\Catalog\Http\Controllers\Concerns\ResolvesActor;
use App\Domain\Catalog\Support\RateDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

final class ProductVersionController
{
    use ResolvesActor;

    public function __construct(private readonly ProductVersions $versions) {}

    public function index(string $code): JsonResponse
    {
        $rows = DB::table('catalog_product_versions as v')->join('catalog_products as p', 'p.id', '=', 'v.product_id')->leftJoin('iam_users as u', 'u.id', '=', 'v.created_by')
            ->where('p.code', $code)->orderByDesc('v.created_at')->get(['v.version', 'v.status', 'v.valid_from', 'v.reason', 'v.created_at', 'u.name as author']);

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request, string $code): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', Rule::in(['minor', 'major'])],
            'valid_from' => ['required', 'date'],
            'reason' => ['required', 'string', 'min:5', 'max:500'],
        ], ['kind.*' => 'Elige si es una versión menor o mayor.', 'valid_from.*' => 'Indica desde cuándo rige.', 'reason.*' => 'Explica el motivo (mínimo 5 caracteres).']);

        return response()->json(['data' => ['version' => $this->versions->create($code, $data['kind'], $data['valid_from'], $data['reason'], $this->actor($request))]], 201);
    }

    public function show(string $code, string $version): JsonResponse
    {
        return response()->json(['data' => $this->versions->show($code, $version)]);
    }

    public function compare(Request $request, string $code): JsonResponse
    {
        $data = $request->validate(['from' => ['required', 'string', 'max:10'], 'to' => ['required', 'string', 'max:10']], ['from.*' => 'Elige la versión A.', 'to.*' => 'Elige la versión B.']);

        return response()->json(['data' => $this->versions->compare($code, $data['from'], $data['to'])]);
    }

    public function duplicate(Request $request, string $code): JsonResponse
    {
        return response()->json(['data' => ['code' => $this->versions->duplicate($code, $this->actor($request))]], 201);
    }

    public function resolve(Request $request, string $code): JsonResponse
    {
        $data = $request->validate([
            'date' => ['required', 'date'],
            'segment' => ['required', Rule::in(['Adulto', 'Niño', 'Infante', 'Pasajero', 'Grupo'])],
            'channel' => ['required', Rule::in(RateDirectory::CHANNELS)],
        ], ['date.*' => 'Elige la fecha del servicio.', 'segment.*' => 'Elige el segmento.', 'channel.*' => 'Elige el canal.']);

        return response()->json(['data' => $this->versions->resolveRate($code, $data['date'], $data['segment'], $data['channel'], $this->actor($request))]);
    }
}
