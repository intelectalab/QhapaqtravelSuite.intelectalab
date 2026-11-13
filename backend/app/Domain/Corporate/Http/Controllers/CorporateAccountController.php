<?php

declare(strict_types=1);

namespace App\Domain\Corporate\Http\Controllers;

use App\Domain\Corporate\Actions\CorporateAccounts;
use App\Domain\Corporate\Actions\CorporateApprovals;
use App\Domain\Corporate\Actions\CorporatePortalUsers;
use App\Domain\Corporate\Actions\CorporateStructure;
use App\Domain\Corporate\Support\CorporateDirectory;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Http\CursorPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

final class CorporateAccountController
{
    public function __construct(private readonly CorporateDirectory $directory) {}

    public function index(Request $request): JsonResponse
    {
        $rows = $this->directory->list($this->user($request));
        $filters = CursorPage::filters($request);
        $rows = array_values(array_filter($rows, fn (array $row): bool => (! isset($filters['status']) || $row['status'] === $filters['status'])
            && (! isset($filters['q']) || str_contains(mb_strtolower($row['client']['name'].' '.$row['client']['code']), mb_strtolower($filters['q'])))));

        return response()->json(CursorPage::respondItems($request, $rows, ['kpis' => [
            'total' => count($rows),
            'active' => count(array_filter($rows, fn (array $row): bool => $row['status'] === 'activa')),
            'suspended' => count(array_filter($rows, fn (array $row): bool => $row['status'] === 'suspendida')),
            'pending_approvals' => array_sum(array_map(fn (array $row): int => $row['counts']['pending_approvals'], $rows)),
        ]]));
    }

    public function options(Request $request): JsonResponse
    {
        $query = DB::table('crm_clients')->whereNull('deleted_at')->where('kind', 'empresa')
            ->whereNotExists(fn ($sub) => $sub->from('crm_corporate_accounts as a')->whereColumn('a.client_id', 'crm_clients.id'));
        Portfolio::clients($query, $this->user($request));

        return response()->json(['data' => [
            'clients' => $query->orderBy('name')->limit(200)->get(['id', 'code', 'name', 'doc_number', 'email'])->map(fn (object $row): array => ['id' => (string) $row->id, 'code' => (string) $row->code, 'name' => (string) $row->name, 'doc_number' => (string) $row->doc_number, 'email' => $row->email])->all(),
            'roles' => collect(CorporateDirectory::ROLES)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values()->all(),
            'budget_periods' => collect(CorporateDirectory::BUDGET_PERIODS)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values()->all(),
            'doc_types' => CorporateStructure::DOC_TYPES,
        ]]);
    }

    public function show(Request $request, string $id, CorporateApprovals $approvals): JsonResponse
    {
        $account = $this->directory->find($id, $this->user($request));

        return response()->json(['data' => [...$this->directory->account($account, true), 'approvals' => $approvals->forAccount($account)]]);
    }

    public function store(Request $request, CorporateAccounts $accounts): JsonResponse
    {
        $data = $request->validate(['client_id' => ['required', 'string', 'max:40'], ...$this->accountRules()], $this->accountMessages());
        $id = $accounts->create(['client' => $data['client_id'], ...$data], $this->user($request));

        return response()->json(['data' => $this->directory->account($this->directory->reload($id), true)], 201);
    }

    public function update(Request $request, string $id, CorporateAccounts $accounts): JsonResponse
    {
        $account = $this->directory->find($id, $this->user($request));
        $data = $request->validate([...$this->accountRules(), 'default_cost_center_id' => ['sometimes', 'nullable', 'string', 'max:40']], $this->accountMessages());
        $accounts->update($account, $data, (int) $request->input('lock_version'));

        return response()->json(['data' => $this->directory->account($this->directory->reload($id), true)]);
    }

    public function suspend(Request $request, string $id, CorporateAccounts $accounts): JsonResponse
    {
        $account = $this->directory->find($id, $this->user($request));
        $data = $request->validate(['active' => ['required', 'boolean'], 'reason' => ['nullable', 'string', 'max:300']], ['active.*' => 'Indica si la cuenta queda activa (true) o suspendida (false).']);
        $accounts->suspend($account, (bool) $data['active'], (int) $request->input('lock_version'), $data['reason'] ?? null);

        return response()->json(['data' => $this->directory->account($this->directory->reload($id), true)]);
    }

    public function costCenters(Request $request, string $id): JsonResponse
    {
        return response()->json(CursorPage::respondItems($request, $this->directory->costCenters($this->directory->find($id, $this->user($request)))));
    }

    public function storeCostCenter(Request $request, string $id, CorporateStructure $structure): JsonResponse
    {
        $account = $this->directory->find($id, $this->user($request));
        $centerId = $structure->createCostCenter($account, $request->validate($this->costCenterRules(true), $this->costCenterMessages()));

        return response()->json(['data' => $this->centerView($id, $centerId)], 201);
    }

    public function updateCostCenter(Request $request, string $id, string $costCenterId, CorporateStructure $structure): JsonResponse
    {
        $account = $this->directory->find($id, $this->user($request));
        $center = $this->directory->costCenter($account, $costCenterId);
        $structure->updateCostCenter($account, $center, $request->validate($this->costCenterRules(false), $this->costCenterMessages()));

        return response()->json(['data' => $this->centerView($id, (string) $center->id)]);
    }

    public function travelers(Request $request, string $id): JsonResponse
    {
        return response()->json(CursorPage::respondItems($request, $this->directory->travelers($this->directory->find($id, $this->user($request)))));
    }

    public function storeTraveler(Request $request, string $id, CorporateStructure $structure): JsonResponse
    {
        $account = $this->directory->find($id, $this->user($request));
        $travelerId = $structure->createTraveler($account, $request->validate(self::travelerRules(true), self::travelerMessages()));

        return response()->json(['data' => $this->directory->traveler($this->directory->travelerRow($account, $travelerId))], 201);
    }

    public function updateTraveler(Request $request, string $id, string $travelerId, CorporateStructure $structure): JsonResponse
    {
        $account = $this->directory->find($id, $this->user($request));
        $traveler = $this->directory->travelerRow($account, $travelerId);
        $structure->updateTraveler($account, $traveler, $request->validate([...self::travelerRules(false), 'active' => ['sometimes', 'boolean']], self::travelerMessages()));

        return response()->json(['data' => $this->directory->traveler($this->directory->travelerRow($account, $travelerId))]);
    }

    public function importTravelers(Request $request, string $id, CorporateStructure $structure): JsonResponse
    {
        $account = $this->directory->find($id, $this->user($request));
        $data = $request->validate([
            'file' => ['required_without:rows', 'file', 'max:2048', 'mimes:csv,txt,xlsx'],
            'rows' => ['required_without:file', 'array', 'max:500'],
            'rows.*' => ['array'],
        ], ['file.*' => 'Sube un CSV o un Excel (.xlsx) de hasta 2 MB.', 'rows.*' => 'Envía las filas a importar.']);

        return response()->json(['data' => $structure->import($account, $data['rows'] ?? [], $request->file('file'))]);
    }

    public function portalUsers(Request $request, string $id): JsonResponse
    {
        return response()->json(CursorPage::respondItems($request, $this->directory->portalUsers($this->directory->find($id, $this->user($request)))));
    }

    public function storePortalUser(Request $request, string $id, CorporatePortalUsers $users): JsonResponse
    {
        $account = $this->directory->find($id, $this->user($request));
        $memberId = $users->invite($account, $request->validate(self::portalUserRules(true), self::portalUserMessages()), $this->user($request));

        return response()->json(['data' => $this->directory->portalUser($this->directory->portalUserRow($account, $memberId))], 201);
    }

    public function updatePortalUser(Request $request, string $id, string $portalUserId, CorporatePortalUsers $users): JsonResponse
    {
        $account = $this->directory->find($id, $this->user($request));
        $member = $this->directory->portalUserRow($account, $portalUserId);
        $users->update($account, $member, $request->validate(self::portalUserRules(false), self::portalUserMessages()));

        return response()->json(['data' => $this->directory->portalUser($this->directory->portalUserRow($account, $portalUserId))]);
    }

    public function resendInvite(Request $request, string $id, string $portalUserId, CorporatePortalUsers $users): JsonResponse
    {
        $account = $this->directory->find($id, $this->user($request));
        $users->resend($account, $this->directory->portalUserRow($account, $portalUserId), $this->user($request));

        return response()->json(['data' => $this->directory->portalUser($this->directory->portalUserRow($account, $portalUserId))]);
    }

    public static function travelerRules(bool $create): array
    {
        $required = $create ? 'required' : 'sometimes';

        return [
            'full_name' => [$required, 'string', 'min:3', 'max:160'],
            'email' => ['sometimes', 'nullable', 'email', 'max:160'],
            'doc_type' => ['sometimes', 'nullable', Rule::in(CorporateStructure::DOC_TYPES)],
            'doc_number' => ['sometimes', 'nullable', 'string', 'max:20'],
            'employee_code' => ['sometimes', 'nullable', 'string', 'max:30'],
            'cost_center_id' => ['sometimes', 'nullable', 'string', 'max:40'],
        ];
    }

    public static function travelerMessages(): array
    {
        return [
            'full_name.*' => 'Escribe el nombre completo del viajero.',
            'email.*' => 'Revisa el correo del viajero.',
            'doc_type.*' => 'El tipo de documento debe ser DNI, CE, PAS, RUC u OTRO.',
            'doc_number.*' => 'El número de documento tiene hasta 20 caracteres.',
            'employee_code.*' => 'El código de empleado tiene hasta 30 caracteres.',
            'cost_center_id.*' => 'Elige un centro de costo de la cuenta.',
        ];
    }

    public static function portalUserRules(bool $create): array
    {
        return $create ? [
            'full_name' => ['required', 'string', 'min:3', 'max:160'],
            'email' => ['required', 'email', 'max:160'],
            'portal_role' => ['required', Rule::in(array_keys(CorporateDirectory::ROLES))],
            'cost_center_id' => ['nullable', 'string', 'max:40'],
            'traveler_id' => ['nullable', 'uuid'],
        ] : [
            'full_name' => ['sometimes', 'string', 'min:3', 'max:160'],
            'portal_role' => ['sometimes', Rule::in(array_keys(CorporateDirectory::ROLES))],
            'cost_center_id' => ['sometimes', 'nullable', 'string', 'max:40'],
            'traveler_id' => ['sometimes', 'nullable', 'uuid'],
            'status' => ['sometimes', Rule::in(['activo', 'inactivo'])],
        ];
    }

    public static function portalUserMessages(): array
    {
        return [
            'full_name.*' => 'Escribe el nombre completo de la persona.',
            'email.*' => 'Escribe un correo corporativo válido.',
            'portal_role.*' => 'Elige el rol: administrador, aprobador, pagador o viajero.',
            'cost_center_id.*' => 'Elige un centro de costo de la cuenta.',
            'traveler_id.*' => 'Elige un viajero de la cuenta.',
            'status.*' => 'El estado puede ser activo o inactivo.',
        ];
    }

    public static function costCenterRules(bool $create): array
    {
        return [
            ...($create ? ['code' => ['required', 'string', 'max:20']] : []),
            'name' => [$create ? 'required' : 'sometimes', 'string', 'min:2', 'max:120'],
            'budget_amount' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:999999999999'],
            'budget_period' => ['sometimes', Rule::in(array_keys(CorporateDirectory::BUDGET_PERIODS))],
            ...($create ? [] : ['active' => ['sometimes', 'boolean']]),
        ];
    }

    public static function costCenterMessages(): array
    {
        return [
            'code.*' => 'Escribe el código del centro de costo, por ejemplo CC-MKT.',
            'name.*' => 'Escribe el nombre del centro de costo.',
            'budget_amount.*' => 'El presupuesto debe ser un monto mayor o igual a cero.',
            'budget_period.*' => 'El período del presupuesto es mensual, trimestral o anual.',
            'active.*' => 'Indica si el centro de costo queda activo.',
        ];
    }

    private function accountRules(): array
    {
        return [
            'currency' => ['sometimes', Rule::in(['PEN', 'USD'])],
            'credit_days' => ['sometimes', 'integer', 'between:0,120'],
            'require_approval' => ['sometimes', 'boolean'],
            'approval_threshold' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:999999999999'],
            'approval_ttl_hours' => ['sometimes', 'integer', 'between:1,720'],
            'statement_auto' => ['sometimes', 'boolean'],
            'statement_day' => ['sometimes', 'integer', 'between:1,28'],
            'statement_recipients' => ['sometimes', 'array', 'max:10'],
            'statement_recipients.*' => ['email', 'max:160'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ];
    }

    private function accountMessages(): array
    {
        return [
            'client_id.*' => 'Elige el cliente empresa de la cuenta.',
            'currency.*' => 'La moneda de la cuenta es PEN o USD.',
            'credit_days.*' => 'Los días de crédito van de 0 a 120.',
            'require_approval.*' => 'Indica si la empresa aprueba las compras antes de reservar.',
            'approval_threshold.*' => 'El umbral de aprobación es un monto mayor o igual a cero.',
            'approval_ttl_hours.*' => 'La vigencia de la solicitud va de 1 a 720 horas.',
            'statement_auto.*' => 'Indica si el estado de cuenta se envía automáticamente.',
            'statement_day.*' => 'El día de envío va del 1 al 28.',
            'statement_recipients.*' => 'Revisa los correos de destino del estado de cuenta.',
            'notes.*' => 'Las notas tienen hasta 1000 caracteres.',
            'default_cost_center_id.*' => 'Elige un centro de costo de la cuenta.',
        ];
    }

    private function centerView(string $accountId, string $centerId): array
    {
        $account = $this->directory->reload($accountId);

        return collect($this->directory->costCenters($account))->firstWhere('id', $centerId) ?? [];
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
