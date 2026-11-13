<?php

declare(strict_types=1);

namespace App\Domain\Booking\Http\Controllers;

use App\Domain\Booking\Actions\CreateDirectReservation;
use App\Domain\Booking\Actions\ProviderServiceResponse;
use App\Domain\Booking\Actions\ReservationChanges;
use App\Domain\Booking\Actions\ReservationLifecycle;
use App\Domain\Booking\Actions\ReservationPartialCancel;
use App\Domain\Booking\Actions\ReservationReschedule;
use App\Domain\Booking\Actions\ReservationServiceRequests;
use App\Domain\Booking\Actions\ReservationWorkflow;
use App\Domain\Booking\Http\Resources\ReservationResource;
use App\Domain\Booking\Models\Reservation;
use App\Domain\Booking\Support\DirectBookingPlan;
use App\Domain\Booking\Support\ReservationDirectory;
use App\Domain\Crm\Support\Advisors;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Operations\Actions\OrderWorkflow;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

final class ReservationController
{
    public function __construct(private readonly ReservationDirectory $directory) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json($this->directory->list($this->user($request), $request));
    }

    public function formOptions(Request $request, Advisors $advisors): JsonResponse
    {
        $user = $this->user($request);

        return response()->json(['data' => [
            'clients' => Portfolio::clients(DB::table('crm_clients')->whereNull('deleted_at'), $user)->orderBy('name')->get(['code', 'name']),
            'advisors' => Portfolio::ownOnly($user) ? [] : $advisors->all(),
            'channels' => DirectBookingPlan::CHANNELS,
            'products' => DB::table('catalog_products')->whereNull('deleted_at')->where('status', 'ACTIVE')->where('is_bookable', true)->orderBy('name')
                ->get(['code', 'name', 'availability_model', 'duration_value', 'duration_unit', 'booking_advance_min_days', 'minimum_passengers', 'maximum_passengers', 'minimum_age'])
                ->map(fn (object $product): array => [
                    'code' => $product->code,
                    'name' => $product->name,
                    'model' => $product->availability_model,
                    'duration' => rtrim(rtrim((string) $product->duration_value, '0'), '.').' '.$product->duration_unit,
                    'advance_min_days' => (int) $product->booking_advance_min_days,
                    'max_pax' => $product->maximum_passengers === null ? null : (int) $product->maximum_passengers,
                    'min_pax' => (int) ($product->minimum_passengers ?? 1),
                    'min_age' => (int) ($product->minimum_age ?? 0),
                ]),
            'owner_id' => (string) $user->getKey(),
            'today' => app(DirectBookingPlan::class)->today()->toDateString(),
        ]]);
    }

    public function availabilityCheck(Request $request, DirectBookingPlan $plans, CreateDirectReservation $action): JsonResponse
    {
        $step = $request->filled('step') ? max(1, min(2, (int) $request->input('step'))) : null;
        $data = $this->directData($request, false, $step);
        $user = $this->user($request);

        if ($step !== null) {
            $action->parties($data, $user);
        }

        if ($step === 1) {
            return response()->json(['data' => ['step' => 1, 'ready' => true]]);
        }

        return response()->json(['data' => $plans->view($plans->build($data, $user, $step === 2), $user)]);
    }

    public function store(Request $request, CreateDirectReservation $action): JsonResponse
    {
        $reservation = $action->handle($this->directData($request, true), $this->user($request));

        return ReservationResource::make($reservation->refresh())->response()->setStatusCode(201);
    }

    public function kpis(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->directory->kpisFor($this->user($request), $request)]);
    }

    public function show(Request $request, string $code): JsonResponse
    {
        return response()->json(['data' => $this->directory->find($this->user($request), $code) ?? throw $this->missing($request, $code)]);
    }

    public function history(Request $request, string $code): JsonResponse
    {
        return response()->json($this->directory->history($this->user($request), $request, $code) ?? throw $this->missing($request, $code));
    }

    public function webSnapshot(Request $request, string $code): JsonResponse
    {
        return response()->json($this->directory->section($this->user($request), $code, 'web-snapshot') ?? throw $this->missing($request, $code));
    }

    public function paxFeedback(Request $request, string $code): JsonResponse
    {
        return response()->json($this->directory->section($this->user($request), $code, 'pax-feedback') ?? throw $this->missing($request, $code));
    }

    public function paxMessages(Request $request, string $code): JsonResponse
    {
        return response()->json($this->directory->section($this->user($request), $code, 'pax-messages') ?? throw $this->missing($request, $code));
    }

    public function update(Request $request, string $code, ReservationWorkflow $workflow): JsonResponse
    {
        $data = $request->validate(['notes' => ['nullable', 'string', 'max:2000']]);
        $workflow->update($code, $data['notes'] ?? null, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function confirm(Request $request, string $code, ReservationLifecycle $lifecycle): JsonResponse
    {
        return $this->resource($lifecycle->confirm($code, $this->user($request)));
    }

    public function occupancy(Request $request): JsonResponse
    {
        $data = $request->validate(['month' => ['nullable', 'date_format:Y-m']], ['month.*' => 'El mes va como AAAA-MM.']);

        return response()->json(['data' => $this->directory->occupancy($this->user($request), $data['month'] ?? null)]);
    }

    public function confirmPreview(Request $request, string $code, ReservationLifecycle $lifecycle): JsonResponse
    {
        return response()->json(['data' => $lifecycle->confirmPreview($code, $this->user($request))]);
    }

    public function startOperation(Request $request, string $code, ReservationLifecycle $lifecycle): JsonResponse
    {
        return $this->resource($lifecycle->startOperation($code, $this->user($request)));
    }

    public function complete(Request $request, string $code, ReservationLifecycle $lifecycle): JsonResponse
    {
        return $this->resource($lifecycle->complete($code, $this->user($request)));
    }

    public function reassign(Request $request, string $code, ReservationLifecycle $lifecycle): JsonResponse
    {
        $data = $request->validate([
            'owner_id' => ['required', 'uuid'],
            'note' => ['nullable', 'string', 'max:300'],
        ], ['owner_id.*' => 'Elige el nuevo asesor.']);

        return $this->resource($lifecycle->reassign($code, $data['owner_id'], $data['note'] ?? null, $this->user($request)));
    }

    public function generateReceivables(Request $request, string $code, ReservationLifecycle $lifecycle): JsonResponse
    {
        return response()->json(['data' => ['code' => $code, 'receivables' => $lifecycle->generateReceivables($code, $this->user($request))]]);
    }

    public function operationOrder(Request $request, string $code, ReservationLifecycle $lifecycle, OrderWorkflow $orders): JsonResponse
    {
        $data = $request->validate(['coordinator_id' => ['nullable', 'uuid']], ['coordinator_id.*' => 'Elige un responsable de Operaciones.']);
        $order = $lifecycle->operationOrder($code, $data['coordinator_id'] ?? null, $this->user($request), $orders);

        return $this->resource(Reservation::query()->where('code', $code)->firstOrFail(), ['order_code' => $order]);
    }

    public function savePassenger(Request $request, string $code, ReservationWorkflow $workflow, ?string $passenger = null): JsonResponse
    {
        $data = $request->validate([
            'full_name' => ['required', 'string', 'min:3', 'max:150'],
            'pax_type' => ['required', 'in:ADT,CHD,INF'],
            'doc_type' => ['nullable', 'in:DNI,Pasaporte,CE'],
            'doc_number' => ['required', 'string', 'max:30'],
            'nationality' => ['required', 'string', 'max:60'],
            'birth_date' => ['required', 'date', 'before:today'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:150'],
            'diet_notes' => ['nullable', 'string', 'max:200'],
            'relationship' => ['nullable', 'in:Titular,Cónyuge / pareja,Hijo/a,Padre / madre,Hermano/a,Amigo/a,Otro'],
            'is_lead' => ['nullable', 'boolean'],
        ], ['full_name.*' => 'Escribe el nombre completo.', 'email.email' => 'Revisa el correo.', 'birth_date.before' => 'La fecha de nacimiento debe ser anterior a hoy.', 'birth_date.required' => 'Indica la fecha de nacimiento (RES-BR-09).', 'doc_number.required' => 'Indica el número de documento (RES-BR-09).', 'nationality.required' => 'Indica la nacionalidad (RES-BR-09).']);

        return response()->json(['data' => $workflow->savePassenger($code, $passenger, $data, $this->user($request))], $passenger ? 200 : 201);
    }

    public function deletePassenger(Request $request, string $code, string $passenger, ReservationWorkflow $workflow): Response
    {
        $workflow->deletePassenger($code, $passenger, $this->user($request));

        return response()->noContent();
    }

    public function requestService(Request $request, string $code, string $service, ReservationServiceRequests $requests): JsonResponse
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:500']]);

        return response()->json(['data' => $requests->request($code, $service, $data['note'] ?? null, $this->user($request))]);
    }

    public function requestPendingServices(Request $request, string $code, ReservationServiceRequests $requests): JsonResponse
    {
        return response()->json(['data' => $requests->requestPending($code, $this->user($request))]);
    }

    public function confirmService(Request $request, string $code, string $service, ReservationServiceRequests $requests): JsonResponse
    {
        $data = $request->validate([
            'confirmation_code' => ['required', 'string', 'min:4', 'max:40'],
            'time' => ['nullable', 'date_format:H:i'],
            'confirmed_by' => ['nullable', 'string', 'max:120'],
            'note' => ['nullable', 'string', 'max:500'],
        ], ['confirmation_code.*' => 'Escribe el código de confirmación del proveedor (al menos 4 caracteres).', 'time.*' => 'Revisa la hora.']);

        return response()->json(['data' => $requests->confirm($code, $service, $data, $this->user($request))]);
    }

    public function rejectService(Request $request, string $code, string $service, ReservationServiceRequests $requests): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['required', Rule::in(ProviderServiceResponse::REJECT_REASONS)],
            'detail' => ['required', 'string', 'min:3', 'max:500'],
            'alternative_date' => ['nullable', 'date', 'after_or_equal:today'],
            'alternative_provider_id' => ['nullable', 'uuid'],
        ], ['reason.*' => 'Elige el motivo del rechazo.', 'detail.*' => 'Cuenta el detalle del rechazo.', 'alternative_date.*' => 'La fecha alternativa no puede ser pasada.']);

        return response()->json(['data' => $requests->reject($code, $service, $data, $this->user($request))]);
    }

    public function cancellationPreview(Request $request, string $code, ReservationWorkflow $workflow): JsonResponse
    {
        return response()->json(['data' => $workflow->cancellationPreview($code, $this->user($request))]);
    }

    public function cancel(Request $request, string $code, ReservationWorkflow $workflow): JsonResponse
    {
        $data = $this->cancelData($request);
        $workflow->cancel($code, $data['reason'], $data['detail'], $this->user($request));

        return $this->resource(Reservation::query()->where('code', $code)->firstOrFail());
    }

    public function partialCancelPreview(Request $request, string $code, ReservationPartialCancel $partial): JsonResponse
    {
        $data = $request->validate(['services' => ['required', 'array', 'min:1', 'max:60'], 'services.*' => ['string', 'max:40']], ['services.*' => 'Elige los servicios que se cancelan.']);

        return response()->json(['data' => $partial->preview($code, $data['services'], $this->user($request))]);
    }

    public function partialCancel(Request $request, string $code, ReservationPartialCancel $partial): JsonResponse
    {
        $data = [...$this->cancelData($request), ...$request->validate(['services' => ['required', 'array', 'min:1', 'max:60'], 'services.*' => ['string', 'max:40']], ['services.*' => 'Elige los servicios que se cancelan.'])];
        $partial->cancel($code, $data['services'], $data['reason'], $data['detail'], $this->user($request));

        return $this->resource(Reservation::query()->where('code', $code)->firstOrFail());
    }

    public function requestCancel(Request $request, string $code, ReservationWorkflow $workflow): JsonResponse
    {
        $data = $this->cancelData($request);

        return response()->json(['data' => $workflow->requestCancel($code, $data['reason'], $data['detail'], $this->user($request))], 201);
    }

    public function rejectCancelRequest(Request $request, string $code, string $cancelRequest, ReservationWorkflow $workflow): JsonResponse
    {
        $data = $request->validate(['note' => ['required', 'string', 'min:3', 'max:500']], ['note.*' => 'Explica por qué no se anula.']);

        return response()->json(['data' => $workflow->rejectCancelRequest($code, $cancelRequest, $data['note'], $this->user($request))]);
    }

    public function changeOptions(Request $request, string $code, ReservationChanges $changes): JsonResponse
    {
        return response()->json(['data' => $changes->options($code, $this->user($request))]);
    }

    public function changePreview(Request $request, string $code, ReservationChanges $changes): JsonResponse
    {
        return response()->json(['data' => $changes->preview($code, $this->changeData($request, false), $this->user($request))]);
    }

    public function requestChange(Request $request, string $code, ReservationChanges $changes): JsonResponse
    {
        $data = $this->changeData($request, true);
        $changes->request($code, $data, $request->boolean('apply_now'), $this->user($request));

        return response()->json(['data' => ['code' => $code]], 201);
    }

    public function approveChange(Request $request, string $code, string $change, ReservationChanges $changes): JsonResponse
    {
        $changes->approve($code, $change, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function rejectChange(Request $request, string $code, string $change, ReservationChanges $changes): JsonResponse
    {
        $data = $request->validate(['note' => ['required', 'string', 'min:3', 'max:500']], ['note.*' => 'Explica por qué no se aplica.']);
        $changes->reject($code, $change, $data['note'], $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function reschedulePreview(Request $request, string $code, ReservationReschedule $reschedule): JsonResponse
    {
        $data = $request->validate(['new_start' => ['nullable', 'date']]);

        return response()->json(['data' => $reschedule->preview($code, $data['new_start'] ?? null, $this->user($request))]);
    }

    public function reschedule(Request $request, string $code, ReservationReschedule $reschedule): JsonResponse
    {
        $data = $request->validate([
            'new_start' => ['required', 'date', 'after_or_equal:today'],
            'reason' => ['required', 'string', 'min:3', 'max:500'],
        ], ['new_start.required' => 'Elige la nueva fecha de inicio.', 'new_start.after_or_equal' => 'La nueva fecha no puede ser pasada.', 'reason.*' => 'Explica por qué cambia la fecha.']);
        $reschedule->apply($code, $data['new_start'], $data['reason'], $this->user($request));

        return $this->resource(Reservation::query()->where('code', $code)->firstOrFail());
    }

    private function resource(Reservation $reservation, array $meta = []): JsonResponse
    {
        return ReservationResource::make($reservation->refresh())->additional($meta === [] ? [] : ['meta' => $meta])->response();
    }

    private function changeData(Request $request, bool $full): array
    {
        return $request->validate([
            'type' => ['required', 'in:'.implode(',', ReservationChanges::TYPES)],
            'extra_pax' => ['required_if:type,pax', 'nullable', 'integer', 'min:1', 'max:40'],
            'product_code' => ['required_if:type,servicio', 'nullable', 'string'],
            'service_date' => ['required_if:type,servicio', 'nullable', 'date', 'after_or_equal:today'],
            'delta' => [$full ? 'nullable' : 'sometimes', 'nullable', 'numeric', 'between:-999999,999999'],
            'description' => [$full ? 'required' : 'nullable', 'nullable', 'string', 'min:3', 'max:500'],
        ], [
            'type.*' => 'Elige qué cambia.',
            'extra_pax.*' => 'Indica cuántos pasajeros se suman.',
            'product_code.required_if' => 'Elige el servicio.',
            'service_date.required_if' => 'Indica la fecha del servicio.',
            'service_date.after_or_equal' => 'La fecha no puede ser pasada.',
            'description.*' => 'Describe el cambio.',
            'delta.*' => 'Revisa el monto.',
        ]);
    }

    private function directData(Request $request, bool $store, ?int $step = null): array
    {
        return $request->validate([
            'step' => ['nullable', 'integer', 'min:1', 'max:2'],
            'client_id' => [$store || $step !== null ? 'required' : 'nullable', 'string', 'max:60'],
            'product_id' => [$step === 1 ? 'nullable' : 'required', 'string', 'max:60'],
            'channel' => ['nullable', Rule::in(DirectBookingPlan::CHANNELS)],
            'owner_id' => ['nullable', 'uuid'],
            'departure_id' => ['nullable', 'uuid'],
            'rate_id' => ['nullable', 'uuid'],
            'date' => ['nullable', 'date'],
            'adt' => [$step === 1 ? 'nullable' : 'required', 'integer', 'min:0', 'max:99'],
            'chd' => ['nullable', 'integer', 'min:0', 'max:99'],
            'inf' => ['nullable', 'integer', 'min:0', 'max:99'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'confirm' => ['nullable', 'boolean'],
        ], [
            'client_id.*' => 'Elige un cliente.',
            'product_id.*' => 'Elige un producto.',
            'channel.*' => 'Elige un canal válido.',
            'adt.*' => 'Indica cuántos adultos viajan.',
            'chd.*' => 'Revisa el número de niños.',
            'inf.*' => 'Revisa el número de infantes.',
            'date.*' => 'Revisa la fecha.',
        ]);
    }

    private function cancelData(Request $request): array
    {
        return $request->validate([
            'reason' => ['required', 'in:'.implode(',', ReservationWorkflow::CANCEL_REASONS)],
            'detail' => ['required', 'string', 'min:3', 'max:500'],
        ], ['reason.*' => 'Elige un motivo.', 'detail.*' => 'Cuenta el detalle.']);
    }

    private function missing(Request $request, string $code): ApiException
    {
        return Portfolio::missing($this->user($request), 'booking_reservations', $code, 'La reserva no existe.', 'Esta reserva');
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
