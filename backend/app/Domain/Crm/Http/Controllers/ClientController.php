<?php

declare(strict_types=1);

namespace App\Domain\Crm\Http\Controllers;

use App\Domain\Crm\Actions\AnonymizeClient;
use App\Domain\Crm\Actions\ClientContacts;
use App\Domain\Crm\Actions\ClientPortalAccess;
use App\Domain\Crm\Actions\ClientWorkflow;
use App\Domain\Crm\Http\Requests\ClientSaveRequest;
use App\Domain\Crm\Support\Advisors;
use App\Domain\Crm\Support\ClientDirectory;
use App\Domain\Crm\Support\ClientTabs;
use App\Domain\Crm\Support\CrmCatalog;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ClientController
{
    public function __construct(private readonly ClientDirectory $directory, private readonly ClientWorkflow $workflow) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->directory->list($this->user($request)), 'meta' => ['today' => $this->directory->today()]]);
    }

    public function show(Request $request, string $code): JsonResponse
    {
        $client = $this->directory->find($this->user($request), $code) ?? throw Portfolio::missing($this->user($request), 'crm_clients', $code, 'El cliente no existe.', 'Este cliente');

        return response()->json(['data' => $client, 'meta' => ['today' => $this->directory->today()]]);
    }

    public function formOptions(Request $request, CrmCatalog $catalog, Advisors $advisors): JsonResponse
    {
        $user = $this->user($request);

        return response()->json(['data' => [
            'segments' => $catalog->options()->get('client_segment', collect())->pluck('label')->values(),
            'advisors' => Portfolio::ownOnly($user) ? [] : $advisors->all()->values(),
            'can_reassign' => ! Portfolio::ownOnly($user),
            'can_manage' => $user->can('crm.clients.manage'),
        ]]);
    }

    public function store(ClientSaveRequest $request): JsonResponse
    {
        return response()->json(['data' => ['code' => $this->workflow->create($request->validated(), $this->user($request))]], 201);
    }

    public function update(ClientSaveRequest $request, string $code): JsonResponse
    {
        $this->workflow->update($code, $request->validated(), $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function archive(Request $request, string $code): JsonResponse
    {
        $request->validate(['reason' => ['nullable', 'string', 'max:300']]);
        $this->workflow->archive($code, $request->input('reason'), $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function invitePortal(Request $request, string $code, ClientPortalAccess $access): JsonResponse
    {
        return response()->json(['data' => $access->invite($code, $this->user($request))], 201);
    }

    public function resendPortal(Request $request, string $code, ClientPortalAccess $access): JsonResponse
    {
        return response()->json(['data' => $access->resend($code, $this->user($request))]);
    }

    public function revokePortal(Request $request, string $code, ClientPortalAccess $access): JsonResponse
    {
        $request->validate(['reason' => ['nullable', 'string', 'max:300']]);

        return response()->json(['data' => $access->revoke($code, $request->input('reason'), $this->user($request))]);
    }

    public function anonymize(Request $request, string $code, AnonymizeClient $anonymize): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['required', 'string', 'min:10', 'max:500'],
            'case' => ['nullable', 'string', 'max:30'],
            'confirm' => ['required', 'accepted'],
        ], [
            'reason.*' => 'Explica el motivo en al menos 10 caracteres (por ejemplo, la solicitud del cliente).',
            'confirm.*' => 'Confirma que entiendes que la supresión no se puede deshacer.',
        ]);

        return response()->json(['data' => $anonymize($code, (string) $data['reason'], $data['case'] ?? null, $this->user($request))]);
    }

    public function tab(Request $request, string $code, string $tab, ClientTabs $tabs): JsonResponse
    {
        return response()->json(['data' => $tabs->read($this->client($request, $code), $tab, $this->user($request))]);
    }

    public function addContact(Request $request, string $code, ClientContacts $contacts): JsonResponse
    {
        $id = $contacts->add($this->client($request, $code), $this->contactData($request) + ['is_primary' => $request->boolean('is_primary')], $this->user($request));

        return response()->json(['data' => ['id' => $id]], 201);
    }

    public function updateContact(Request $request, string $code, string $contact, ClientContacts $contacts): JsonResponse
    {
        $contacts->update($this->client($request, $code), $contact, $this->contactData($request), $this->user($request));

        return response()->json(['data' => ['id' => $contact]]);
    }

    public function makePrimaryContact(Request $request, string $code, string $contact, ClientContacts $contacts): JsonResponse
    {
        $contacts->makePrimary($this->client($request, $code), $contact, $this->user($request));

        return response()->json(['data' => ['id' => $contact]]);
    }

    public function removeContact(Request $request, string $code, string $contact, ClientContacts $contacts): JsonResponse
    {
        $contacts->remove($this->client($request, $code), $contact, $this->user($request));

        return response()->json(null, 204);
    }

    public function communicate(Request $request, string $code, ClientContacts $contacts): JsonResponse
    {
        $data = $request->validate([
            'recipient' => ['nullable', 'email', 'max:200'],
            'subject' => ['required', 'string', 'min:3', 'max:200'],
            'body' => ['required', 'string', 'min:5', 'max:5000'],
        ], ['subject.*' => 'Escribe el asunto.', 'body.*' => 'Escribe el mensaje.', 'recipient.email' => 'El correo no es válido.']);

        return response()->json(['data' => ['code' => $contacts->communicate($this->client($request, $code), $data, $this->user($request))]], 201);
    }

    private function client(Request $request, string $code): object
    {
        return $this->directory->record($this->user($request), $code) ?? throw Portfolio::missing($this->user($request), 'crm_clients', $code, 'El cliente no existe.', 'Este cliente');
    }

    private function contactData(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:150'],
            'role' => ['nullable', 'string', 'max:100'],
            'email' => ['nullable', 'email', 'max:200'],
            'phone' => ['nullable', 'string', 'max:40'],
        ], ['name.*' => 'Escribe el nombre del contacto.', 'email.email' => 'El correo no es válido.']);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
