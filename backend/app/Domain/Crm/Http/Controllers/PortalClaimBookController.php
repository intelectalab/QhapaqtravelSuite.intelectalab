<?php

declare(strict_types=1);

namespace App\Domain\Crm\Http\Controllers;

use App\Domain\Crm\Support\ClaimBookDirectory;
use App\Domain\Crm\Support\ClaimConsumer;
use App\Domain\Iam\Models\User;
use App\Domain\Portal\Support\PortalAccount;
use App\Domain\Shared\Http\CursorPage;
use App\Domain\Site\Actions\RegisterWebClaim;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class PortalClaimBookController
{
    public function index(Request $request, ClaimBookDirectory $directory): JsonResponse
    {
        $account = $this->account($request);
        $filters = CursorPage::filters($request);
        $scope = fn (Builder $query) => $query
            ->when($account->isPassenger(), fn (Builder $own) => $own->where('k.submitted_by', $account->user->getKey()), fn (Builder $own) => $own->where('k.client_id', $account->client->id))
            ->when(isset($filters['type']), fn (Builder $own) => $own->where('k.type_code', $filters['type']))
            ->when(isset($filters['status']), fn (Builder $own) => $own->where('k.book_status', $filters['status']));

        return response()->json(CursorPage::respondItems($request, $directory->claims($scope)->map(fn (array $claim): array => $this->present($claim))->values()->all()));
    }

    public function store(Request $request, RegisterWebClaim $register, ClaimBookDirectory $directory): JsonResponse
    {
        $account = $this->account($request);
        $client = $account->client;
        $request->mergeIfMissing(array_filter([
            'name' => $client->name,
            'doc_type' => $this->docType($client->doc_type),
            'doc_number' => $client->doc_number,
            'email' => $account->user->email,
            'phone' => $client->phone,
            'reservation' => $account->isPassenger() ? DB::table('booking_reservations')->where('id', $account->reservationId)->value('code') : null,
        ], fn (mixed $value): bool => $value !== null && $value !== ''));

        $data = $request->validate([
            'name' => ['required', 'string', 'min:5', 'max:150', 'regex:/\S+\s+\S+/u'],
            'doc_type' => ['required', 'in:DNI,CE,Pasaporte,RUC'],
            'doc_number' => ['required', 'string', ...ClaimConsumer::docRule($request->input('doc_type'))],
            'email' => ['required', 'email', 'max:190'],
            'phone' => ['required', 'string', 'regex:/^[0-9+()\s-]{7,20}$/'],
            'address' => ['required', 'string', 'min:5', 'max:250'],
            ...ClaimConsumer::guardianRules($request->input('guardian_doc_type')),
            'sede_id' => ['required', 'uuid'],
            'good_kind' => ['required', 'in:producto,servicio'],
            'good_description' => ['required', 'string', 'min:3', 'max:300'],
            'good_amount' => ['nullable', 'numeric', 'min:0', 'max:1000000'],
            'good_currency' => ['nullable', 'in:PEN,USD'],
            'type' => ['required', 'in:reclamo,queja'],
            'detail' => ['required', 'string', 'min:15', 'max:3000'],
            'request' => ['required', 'string', 'min:5', 'max:1500'],
            'reservation' => ['nullable', 'string', 'max:30'],
            'declaration' => ['accepted'],
        ], [
            'name.*' => 'Escribe nombres y apellidos completos.',
            'doc_type.*' => 'Elige el tipo de documento.',
            'doc_number.*' => 'El número de documento no es válido para el tipo elegido.',
            'email.*' => 'Escribe un correo válido; ahí te enviaremos la constancia.',
            'phone.*' => 'Escribe un teléfono válido.',
            'address.*' => 'Escribe tu domicilio.',
            ...ClaimConsumer::guardianMessages(),
            'sede_id.*' => 'Elige el establecimiento.',
            'good_kind.*' => 'Indica si es un producto o un servicio.',
            'good_description.*' => 'Describe el producto o servicio contratado.',
            'good_amount.*' => 'Revisa el monto reclamado.',
            'type.*' => 'Elige si es un reclamo o una queja.',
            'detail.*' => 'Detalla lo ocurrido (al menos 15 caracteres).',
            'request.*' => 'Indica qué solicitas a la agencia.',
            'declaration.*' => 'Confirma que la información es verdadera y que aceptas recibir la respuesta en tu correo.',
        ]);

        if ($account->isPassenger()) {
            $data['reservation'] = DB::table('booking_reservations')->where('id', $account->reservationId)->value('code');
        }

        $result = $register->handle($data, $account->isPassenger() ? 'passenger_portal' : 'customer_portal', (string) $client->id, (string) $account->user->getKey());

        return response()->json(['data' => $this->present($directory->find($result['number']))], 201);
    }

    private function present(array $claim): array
    {
        return [
            'code' => $claim['code'],
            'number' => $claim['book_number'],
            'type' => $claim['type_code'],
            'type_label' => $claim['type'],
            'sede' => $claim['sede'],
            'channel' => $claim['channel'],
            'status' => $claim['book_status'],
            'status_label' => $claim['book_status_label'],
            'received_at' => $claim['received_at'],
            'due_date' => $claim['due_date'],
            'detail' => $claim['detail'],
            'request' => $claim['request'],
            'good' => $claim['good'],
            'reservation' => $claim['reservation'],
            'response' => $claim['response'] && $claim['response']['text'] ? ['decision' => $claim['response']['decision'], 'text' => $claim['response']['text'], 'actions' => $claim['response']['actions'], 'answered_at' => $claim['response']['answered_at']] : null,
        ];
    }

    private function docType(?string $stored): ?string
    {
        return match (strtoupper((string) $stored)) {
            'DNI' => 'DNI',
            'CE' => 'CE',
            'RUC' => 'RUC',
            'PASAPORTE', 'PAS' => 'Pasaporte',
            default => null,
        };
    }

    private function account(Request $request): PortalAccount
    {
        $user = $request->user();
        assert($user instanceof User);

        return PortalAccount::of($user);
    }
}
