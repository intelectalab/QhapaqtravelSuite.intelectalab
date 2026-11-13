<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Http\Controllers;

use App\Domain\Catalog\Actions\AllotmentRegistry;
use App\Domain\Catalog\Http\Controllers\Concerns\ResolvesActor;
use App\Domain\Catalog\Support\AllotmentDirectory;
use App\Domain\Catalog\Support\CatalogAccess;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Http\CursorPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class AllotmentController
{
    use ResolvesActor;

    public function __construct(private readonly AllotmentRegistry $registry, private readonly AllotmentDirectory $directory) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->directory->overview($this->actor($request))]);
    }

    public function grid(Request $request): JsonResponse
    {
        $data = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'days' => ['nullable', 'integer', 'between:7,31'],
            'kind' => ['nullable', Rule::in(AllotmentDirectory::KINDS)],
            'all' => ['nullable', 'boolean'],
        ]);

        return response()->json(['data' => $this->directory->grid($data['from'] ?? null, (int) ($data['days'] ?? 14), $data['kind'] ?? null, (bool) ($data['all'] ?? false))]);
    }

    public function pickup(Request $request): JsonResponse
    {
        $data = $request->validate(['days' => ['nullable', 'integer', 'between:7,90'], 'weeks' => ['nullable', 'integer', 'between:4,12']]);

        return response()->json(['data' => $this->directory->pickup((int) ($data['days'] ?? 30), (int) ($data['weeks'] ?? 8))]);
    }

    public function show(Request $request, string $code): JsonResponse
    {
        return response()->json(['data' => $this->directory->detail($code, $this->actor($request))]);
    }

    public function charges(Request $request, string $code): JsonResponse
    {
        $detail = $this->directory->detail($code, $this->actor($request));

        return response()->json(CursorPage::respondItems($request, collect($detail['charges'])->values()->all(), ['total' => $detail['penalties']]));
    }

    public function requests(Request $request, string $code): JsonResponse
    {
        $status = CursorPage::filters($request)['status'] ?? null;
        $items = collect($this->directory->detail($code, $this->actor($request))['requests'])
            ->when($status, fn ($rows) => $rows->whereIn('status', explode(',', (string) $status)))->values()->all();

        return response()->json(CursorPage::respondItems($request, $items));
    }

    public function day(Request $request, string $code, string $date): JsonResponse
    {
        $detail = $this->directory->detail($code, $this->actor($request));
        $day = collect($detail['days'])->firstWhere('date', $date) ?? throw ApiException::notFound('Ese día no está dentro del contrato de cupo.');

        return response()->json(['data' => [
            ...$day,
            'allotment' => ['code' => $detail['contract']['code'] ?? $code],
            'consumptions' => collect($detail['consumptions'])->where('date', $date)->values(),
            'charges' => collect($detail['charges'])->where('date', $date)->values(),
        ]]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->contractData($request, true);

        return response()->json(['data' => ['code' => $this->registry->create($data, $this->actor($request))]], 201);
    }

    public function update(Request $request, string $code): JsonResponse
    {
        $data = $this->contractData($request, false);

        return response()->json(['data' => ['code' => $this->registry->update($code, $data, $this->version($request), $this->actor($request))]]);
    }

    public function destroy(Request $request, string $code): JsonResponse
    {
        $this->registry->delete($code, $this->reason($request), $this->actor($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function release(Request $request, string $code): JsonResponse
    {
        $units = $this->registry->releaseContract($code, $this->reason($request), $this->version($request), $this->actor($request));

        return response()->json(['data' => ['code' => $code, 'released' => $units]]);
    }

    public function releaseDay(Request $request, string $code, string $date): JsonResponse
    {
        $qty = (int) $request->validate(['qty' => ['required', 'integer', 'min:1']], ['qty.*' => 'Indica cuántas unidades liberar.'])['qty'];
        $this->registry->releaseDay($code, $this->date($date), $qty, $this->version($request), $this->actor($request));

        return response()->json(['data' => ['code' => $code, 'date' => $date]]);
    }

    public function retain(Request $request, string $code, string $date): JsonResponse
    {
        $this->registry->retain($code, $this->date($date), $this->reason($request, 200), $this->version($request), $this->actor($request));

        return response()->json(['data' => ['code' => $code, 'date' => $date]]);
    }

    public function unretain(Request $request, string $code, string $date): JsonResponse
    {
        $this->registry->unretain($code, $this->date($date), $this->version($request), $this->actor($request));

        return response()->json(['data' => ['code' => $code, 'date' => $date]]);
    }

    public function storeRequest(Request $request, string $code): JsonResponse
    {
        $data = $request->validate([
            'date_from' => ['required', 'date_format:Y-m-d'],
            'date_to' => ['required', 'date_format:Y-m-d', 'after_or_equal:date_from'],
            'extra_qty' => ['required', 'integer', 'between:1,500'],
            'note' => ['required', 'string', 'min:3', 'max:500'],
        ], [
            'date_from.*' => 'Indica desde cuándo.',
            'date_to.after_or_equal' => 'La ampliación debe terminar después de empezar.',
            'date_to.*' => 'Indica hasta cuándo.',
            'extra_qty.*' => 'Indica entre 1 y 500 unidades adicionales por fecha.',
            'note.*' => 'Escribe el motivo para el proveedor.',
        ]);

        return response()->json(['data' => ['code' => $this->registry->requestExpansion($code, $data, $this->actor($request))]], 201);
    }

    public function respondRequest(Request $request, string $code, string $requestCode): JsonResponse
    {
        $data = $request->validate([
            'accepted' => ['required', 'boolean'],
            'response' => ['required', 'string', 'min:3', 'max:500'],
        ], [
            'accepted.*' => 'Indica si el proveedor aceptó o rechazó.',
            'response.*' => 'Escribe la respuesta del proveedor.',
        ]);
        $this->registry->respondExpansion($code, $requestCode, (bool) $data['accepted'], trim($data['response']), $this->actor($request));

        return response()->json(['data' => ['code' => $requestCode]]);
    }

    public function runJob(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->registry->runReleaseJob($this->actor($request))], 202);
    }

    private function contractData(Request $request, bool $creating): array
    {
        return $request->validate([
            'provider_id' => [$creating ? 'required' : 'prohibited', 'uuid'],
            'service_id' => [$creating ? 'required' : 'prohibited', 'uuid'],
            'name' => ['required', 'string', 'min:3', 'max:150'],
            'contract_ref' => ['nullable', 'string', 'max:80'],
            'valid_from' => ['required', 'date_format:Y-m-d'],
            'valid_to' => ['required', 'date_format:Y-m-d', 'after_or_equal:valid_from', ...($creating ? ['after_or_equal:'.CatalogAccess::today()] : [])],
            'base_qty' => ['required', 'integer', 'between:1,500'],
            'release_days' => ['required', 'integer', 'between:0,120'],
            'net_rate' => ['required', 'numeric', 'between:0,999999'],
            'currency' => ['required', Rule::in(CatalogAccess::CURRENCIES)],
            'penalty_pct' => ['required', 'numeric', 'between:0,100'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'lock_version' => ['nullable', 'integer'],
        ], [
            'provider_id.required' => 'Elige el proveedor.',
            'service_id.required' => 'Elige el servicio contratado.',
            'provider_id.prohibited' => 'El proveedor de un contrato no se cambia.',
            'service_id.prohibited' => 'El servicio de un contrato no se cambia.',
            'name.*' => 'Ponle un nombre al cupo (3 a 150 caracteres).',
            'contract_ref.*' => 'La referencia admite hasta 80 caracteres.',
            'valid_from.*' => 'Indica desde cuándo rige.',
            'valid_to.after_or_equal' => 'La vigencia debe terminar después de empezar y no puede estar ya vencida.',
            'valid_to.*' => 'Indica hasta cuándo rige.',
            'base_qty.*' => 'El bloqueo base va de 1 a 500 unidades por fecha.',
            'release_days.*' => 'Los días de release van de 0 a 120.',
            'net_rate.*' => 'Indica la tarifa neta.',
            'currency.*' => 'Elige la moneda.',
            'penalty_pct.*' => 'La penalidad va de 0 a 100 %.',
            'notes.*' => 'Las notas admiten hasta 2000 caracteres.',
        ]);
    }

    private function reason(Request $request, int $max = 300): string
    {
        return trim((string) $request->validate(['reason' => ['required', 'string', 'min:3', "max:{$max}"]], ['reason.*' => 'Escribe el motivo.'])['reason']);
    }

    private function version(Request $request): ?int
    {
        $value = $request->header('If-Match') ?? $request->input('lock_version');

        return is_numeric($value) ? (int) $value : null;
    }

    private function date(string $date): string
    {
        validator(['date' => $date], ['date' => ['date_format:Y-m-d']], ['date.*' => 'La fecha no es válida.'])->validate();

        return $date;
    }
}
