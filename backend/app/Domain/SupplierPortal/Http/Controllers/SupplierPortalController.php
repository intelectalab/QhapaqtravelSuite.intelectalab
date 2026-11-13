<?php

declare(strict_types=1);

namespace App\Domain\SupplierPortal\Http\Controllers;

use App\Domain\Booking\Actions\ProviderServiceResponse;
use App\Domain\Iam\Models\User;
use App\Domain\SupplierPortal\Actions\ProposeAlternative;
use App\Domain\SupplierPortal\Actions\RespondServiceRequest;
use App\Domain\SupplierPortal\Actions\SupplierContacts;
use App\Domain\SupplierPortal\Actions\SupplierInvoices;
use App\Domain\SupplierPortal\Actions\SupplierRateRequests;
use App\Domain\SupplierPortal\Support\SupplierAccount;
use App\Domain\SupplierPortal\Support\SupplierDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

final class SupplierPortalController
{
    public function __construct(private readonly SupplierDirectory $directory) {}

    public function session(Request $request): JsonResponse
    {
        return $this->json($this->directory->session($this->account($request)));
    }

    public function home(Request $request): JsonResponse
    {
        return $this->json($this->directory->home($this->account($request)));
    }

    public function requests(Request $request): JsonResponse
    {
        return $this->json($this->directory->requests($this->account($request)));
    }

    public function request(Request $request, string $code): JsonResponse
    {
        return $this->json($this->directory->request($this->account($request), $code));
    }

    public function confirm(Request $request, string $code, RespondServiceRequest $respond): JsonResponse
    {
        $account = $this->account($request);
        $data = $request->validate([
            'confirmation_code' => ['required', 'string', 'min:4', 'max:40', 'regex:/^[A-Za-z0-9\-\/\.]+$/'],
            'service_time' => ['nullable', 'date_format:H:i'],
            'confirmed_by_name' => ['nullable', 'string', 'max:120'],
            'note' => ['nullable', 'string', 'max:500'],
        ], [
            'confirmation_code.*' => 'Escriba el código de confirmación (mínimo 4 caracteres, sin espacios).',
            'service_time.*' => 'Escriba la hora en formato 24 h, por ejemplo 14:00.',
            'confirmed_by_name.*' => 'El nombre de quien confirma es muy largo.',
            'note.*' => 'La observación admite hasta 500 caracteres.',
        ]);
        $respond->confirm($account, $code, $data);

        return $this->json(['code' => $code]);
    }

    public function reject(Request $request, string $code, RespondServiceRequest $respond): JsonResponse
    {
        $account = $this->account($request);
        $data = $request->validate([
            'reason' => ['required', Rule::in(ProviderServiceResponse::REJECT_REASONS)],
            'note' => ['required', 'string', 'min:5', 'max:1000'],
            'alt_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:'.Carbon::today()->toDateString()],
        ], [
            'reason.*' => 'Elija el motivo del rechazo.',
            'note.*' => 'Explique brevemente el motivo (mínimo 5 caracteres).',
            'alt_date.*' => 'La fecha alternativa debe ser hoy o posterior.',
        ]);

        return $this->json(['code' => $code, 'alternative' => $respond->reject($account, $code, $data)]);
    }

    public function alternative(Request $request, string $code, ProposeAlternative $propose): JsonResponse
    {
        $account = $this->account($request);
        $data = $request->validate([
            'alt_kind' => ['required', Rule::in(ProposeAlternative::KINDS)],
            'alt_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:'.Carbon::today()->toDateString()],
            'alt_service' => ['nullable', 'string', 'max:30'],
            'alt_net_cost' => ['nullable', 'numeric', 'gt:0', 'max:9999999'],
            'hold_until' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:'.Carbon::today()->toDateString()],
            'note' => ['required', 'string', 'min:5', 'max:1000'],
        ], [
            'alt_kind.*' => 'Elija el tipo de alternativa.',
            'alt_date.*' => 'La fecha propuesta debe ser hoy o posterior.',
            'alt_service.*' => 'Elija un servicio de su catálogo.',
            'alt_net_cost.*' => 'Escriba una tarifa neta válida.',
            'hold_until.*' => 'El bloqueo debe mantenerse hasta hoy o una fecha posterior.',
            'note.*' => 'Describa la alternativa (mínimo 5 caracteres).',
        ]);

        return $this->json(['code' => $code, 'response' => $propose->handle($account, $code, $data)], 201);
    }

    public function calendar(Request $request): JsonResponse
    {
        return $this->json($this->directory->calendar($this->account($request), $request->query('month') ? (string) $request->query('month') : null));
    }

    public function rates(Request $request, SupplierRateRequests $requests): JsonResponse
    {
        return $this->json($this->directory->rates($this->account($request), $requests));
    }

    public function storeRateRequest(Request $request, SupplierRateRequests $requests): JsonResponse
    {
        $account = $this->account($request);

        return $this->json(['code' => $requests->create($account, $this->rateData($request, true))], 201);
    }

    public function updateRateRequest(Request $request, string $code, SupplierRateRequests $requests): JsonResponse
    {
        $account = $this->account($request);
        $requests->update($account, $code, $this->rateData($request, false));

        return $this->json(['code' => $code]);
    }

    public function withdrawRateRequest(Request $request, string $code, SupplierRateRequests $requests): JsonResponse
    {
        $requests->withdraw($this->account($request), $code);

        return $this->json(['code' => $code]);
    }

    public function payables(Request $request): JsonResponse
    {
        return $this->json($this->directory->payables($this->account($request)));
    }

    public function storeInvoice(Request $request, string $code, SupplierInvoices $invoices): JsonResponse
    {
        $account = $this->account($request);
        $data = $request->validate([
            'number' => ['required', 'string', 'max:20', 'regex:/^[A-Za-z0-9]{4}-\d{1,8}$/'],
            'issue_date' => ['required', 'date_format:Y-m-d', 'before_or_equal:'.Carbon::tomorrow()->toDateString()],
            'amount' => ['required', 'numeric', 'gt:0', 'max:99999999'],
            'file_name' => ['required', 'string', 'max:200', 'regex:/\.(pdf|xml|zip)$/i'],
            'file_content' => ['required', 'string'],
        ], [
            'number.*' => 'Escriba la serie y el número, por ejemplo F001-4521.',
            'issue_date.*' => 'La fecha de emisión no puede ser futura.',
            'amount.*' => 'Escriba el importe de la factura.',
            'file_name.*' => 'Adjunte la factura en PDF, XML o ZIP.',
            'file_content.*' => 'Adjunte la factura en PDF, XML o ZIP.',
        ]);

        return $this->json($invoices->register($account, $code, $data), 201);
    }

    public function company(Request $request): JsonResponse
    {
        return $this->json($this->directory->company($this->account($request)));
    }

    public function storeContact(Request $request, SupplierContacts $contacts): JsonResponse
    {
        $account = $this->account($request);
        $contacts->save($account, null, $this->contactData($request));

        return $this->json(['ok' => true], 201);
    }

    public function updateContact(Request $request, string $id, SupplierContacts $contacts): JsonResponse
    {
        $account = $this->account($request);
        $contacts->save($account, $id, $this->contactData($request));

        return $this->json(['ok' => true]);
    }

    public function deleteContact(Request $request, string $id, SupplierContacts $contacts): JsonResponse
    {
        $contacts->delete($this->account($request), $id);

        return $this->json(['ok' => true]);
    }

    private function rateData(Request $request, bool $withService): array
    {
        return $request->validate([
            'service' => [$withService ? 'required' : 'nullable', 'string', 'max:20'],
            'proposed_cost' => ['required', 'numeric', 'gt:0', 'max:9999999'],
            'effective_from' => ['required', 'date_format:Y-m-d'],
            'reason_type' => ['required', Rule::in(SupplierRateRequests::REASONS)],
            'reason_detail' => ['nullable', 'string', 'max:1000'],
        ], [
            'service.*' => 'Elija el servicio.',
            'proposed_cost.*' => 'Escriba la nueva tarifa (mayor a cero).',
            'effective_from.*' => 'Indique desde qué fecha rige.',
            'reason_type.*' => 'Elija el motivo.',
            'reason_detail.*' => 'El sustento admite hasta 1000 caracteres.',
        ]);
    }

    private function contactData(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:150'],
            'role' => ['nullable', 'string', 'max:80'],
            'phone' => ['nullable', 'string', 'max:30', 'regex:/^[0-9+()\s-]{6,30}$/'],
            'email' => ['nullable', 'email', 'max:190'],
        ], [
            'name.*' => 'Escriba el nombre del contacto.',
            'role.*' => 'El cargo admite hasta 80 caracteres.',
            'phone.*' => 'Escriba un teléfono válido.',
            'email.*' => 'Escriba un correo válido.',
        ]);
    }

    private function account(Request $request): SupplierAccount
    {
        $user = $request->user();
        assert($user instanceof User);

        return SupplierAccount::of($user);
    }

    private function json(array $data, int $status = 200): JsonResponse
    {
        return response()->json(['data' => $data], $status);
    }
}
