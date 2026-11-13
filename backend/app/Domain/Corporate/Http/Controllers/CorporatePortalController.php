<?php

declare(strict_types=1);

namespace App\Domain\Corporate\Http\Controllers;

use App\Domain\Corporate\Actions\CorporateApprovals;
use App\Domain\Corporate\Actions\CorporateExports;
use App\Domain\Corporate\Actions\CorporatePortalUsers;
use App\Domain\Corporate\Actions\CorporateStatements;
use App\Domain\Corporate\Actions\CorporateStructure;
use App\Domain\Corporate\Support\CorporateDirectory;
use App\Domain\Corporate\Support\CorporateMember;
use App\Domain\Corporate\Support\CorporatePeriod;
use App\Domain\Corporate\Support\CorporateReports;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

final class CorporatePortalController
{
    public function __construct(private readonly CorporateDirectory $directory, private readonly CorporateReports $reports) {}

    public function summary(Request $request): JsonResponse
    {
        $member = $this->member($request);

        return response()->json(['data' => $this->reports->summary($member->account, $this->period($request), $member->scope()), 'meta' => ['panel' => $this->panel($member)]]);
    }

    public function purchases(Request $request): JsonResponse
    {
        $member = $this->member($request);
        $period = $this->period($request);

        return response()->json(['data' => ['period' => ['key' => $period->key, 'label' => $period->label], 'currency' => (string) $member->account->currency, 'items' => $this->reports->purchases($member->account, $period, $member->scope())]]);
    }

    public function movements(Request $request, CorporateExports $exports): JsonResponse
    {
        $member = $this->member($request);

        return response()->json(['data' => [...$this->reports->movements($member->account, $this->period($request), $member->scope()), 'exports' => array_slice($exports->list($member), 0, 6)]]);
    }

    public function statements(Request $request, CorporateStatements $statements): JsonResponse
    {
        $member = $this->member($request);
        $member->require('statements.view', 'Los estados de cuenta los ven el administrador, el pagador y los aprobadores de la empresa.');
        $rows = DB::table('fin_corporate_statements')->where('account_id', $member->account->id)->where('status', '<>', 'anulado')->orderByDesc('period_start')->get();

        return response()->json(['data' => [
            'items' => $rows->map(fn (object $row): array => $statements->present($row))->values()->all(),
            'settings' => $statements->settingsView($member->account),
            'can_manage' => $member->can('statements.manage'),
        ]]);
    }

    public function statementPdf(Request $request, string $code, CorporateStatements $statements): Response|JsonResponse
    {
        $member = $this->member($request);
        $member->require('statements.view', 'Los estados de cuenta los ven el administrador, el pagador y los aprobadores de la empresa.');
        $statement = $statements->find($code, $member->account);

        if ($statement->status === 'anulado') {
            throw ApiException::notFound('Ese estado de cuenta fue anulado.');
        }

        return $statements->pdf($statement, $request);
    }

    public function statementSettings(Request $request, CorporateStatements $statements): JsonResponse
    {
        $member = $this->member($request);
        $data = $request->validate([
            'statement_auto' => ['required', 'boolean'],
            'statement_day' => ['required', 'integer', 'between:1,28'],
            'statement_recipients' => ['present', 'array', 'max:10'],
            'statement_recipients.*' => ['email', 'max:160'],
        ], [
            'statement_auto.*' => 'Indica si el envío automático queda activo.',
            'statement_day.*' => 'El día de envío va del 1 al 28.',
            'statement_recipients.*' => 'Revisa los correos de destino.',
        ]);

        return response()->json(['data' => $statements->settings($member, $data, (int) $request->input('lock_version'))]);
    }

    public function approvals(Request $request, CorporateApprovals $approvals): JsonResponse
    {
        $member = $this->member($request);
        $member->require('approvals', 'Las aprobaciones las ven el administrador y los aprobadores de la empresa.');

        return response()->json(['data' => $approvals->list($member), 'meta' => [
            'require_approval' => (bool) $member->account->require_approval,
            'threshold' => $member->account->approval_threshold,
            'currency' => (string) $member->account->currency,
            'ttl_hours' => (int) $member->account->approval_ttl_hours,
        ]]);
    }

    public function approve(Request $request, string $code, CorporateApprovals $approvals): JsonResponse
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:500']], ['note.*' => 'La nota tiene hasta 500 caracteres.']);

        return response()->json(['data' => $approvals->decide($this->member($request), $code, true, $data['note'] ?? null, (int) $request->input('lock_version'))]);
    }

    public function reject(Request $request, string $code, CorporateApprovals $approvals): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']], ['reason.*' => 'Escribe el motivo del rechazo (al menos 5 caracteres).']);

        return response()->json(['data' => $approvals->decide($this->member($request), $code, false, $data['reason'], (int) $request->input('lock_version'))]);
    }

    public function users(Request $request): JsonResponse
    {
        $member = $this->member($request);
        $member->require('manage', 'Solo el administrador de la empresa gestiona los usuarios del panel.');

        return response()->json(['data' => $this->directory->portalUsers($member->account)]);
    }

    public function inviteUser(Request $request, CorporatePortalUsers $users): JsonResponse
    {
        $member = $this->member($request);
        $member->require('manage', 'Solo el administrador de la empresa invita usuarios al panel.');
        $id = $users->invite($member->account, $request->validate(CorporateAccountController::portalUserRules(true), CorporateAccountController::portalUserMessages()), $this->user($request));

        return response()->json(['data' => $this->directory->portalUser($this->directory->portalUserRow($member->account, $id))], 201);
    }

    public function updateUser(Request $request, string $portalUserId, CorporatePortalUsers $users): JsonResponse
    {
        $member = $this->member($request);
        $member->require('manage', 'Solo el administrador de la empresa cambia roles o desactiva usuarios.');
        $row = $this->directory->portalUserRow($member->account, $portalUserId);
        $users->update($member->account, $row, $request->validate(CorporateAccountController::portalUserRules(false), CorporateAccountController::portalUserMessages()));

        return response()->json(['data' => $this->directory->portalUser($this->directory->portalUserRow($member->account, $portalUserId))]);
    }

    public function costCenters(Request $request): JsonResponse
    {
        $member = $this->member($request);

        return response()->json(['data' => $this->directory->costCenters($member->account, $member->scope()->costCenter !== null ? $member->scope() : null)]);
    }

    public function storeCostCenter(Request $request, CorporateStructure $structure): JsonResponse
    {
        $member = $this->member($request);
        $member->require('manage', 'Solo el administrador de la empresa crea centros de costo.');
        $id = $structure->createCostCenter($member->account, $request->validate(CorporateAccountController::costCenterRules(true), CorporateAccountController::costCenterMessages()));

        return response()->json(['data' => collect($this->directory->costCenters($this->directory->reload((string) $member->account->id)))->firstWhere('id', $id)], 201);
    }

    public function updateCostCenter(Request $request, string $code, CorporateStructure $structure): JsonResponse
    {
        $member = $this->member($request);
        $member->require('manage', 'Solo el administrador de la empresa edita los centros de costo.');
        $center = $this->directory->costCenter($member->account, $code);
        $structure->updateCostCenter($member->account, $center, $request->validate(CorporateAccountController::costCenterRules(false), CorporateAccountController::costCenterMessages()));

        return response()->json(['data' => collect($this->directory->costCenters($this->directory->reload((string) $member->account->id)))->firstWhere('id', $center->id)]);
    }

    public function travelers(Request $request): JsonResponse
    {
        $member = $this->member($request);
        $member->require('travelers.view', 'Los viajeros de la empresa los ven el administrador y los aprobadores.');

        return response()->json(['data' => $this->directory->travelers($member->account, $member->scope()->costCenter !== null ? $member->scope() : null)]);
    }

    public function storeTraveler(Request $request, CorporateStructure $structure): JsonResponse
    {
        $member = $this->member($request);
        $member->require('manage', 'Solo el administrador de la empresa registra viajeros.');
        $id = $structure->createTraveler($member->account, $request->validate(CorporateAccountController::travelerRules(true), CorporateAccountController::travelerMessages()));

        return response()->json(['data' => $this->directory->traveler($this->directory->travelerRow($member->account, $id))], 201);
    }

    public function exports(Request $request, CorporateExports $exports): JsonResponse
    {
        return response()->json(['data' => $exports->list($this->member($request))]);
    }

    public function requestExport(Request $request, CorporateExports $exports): JsonResponse
    {
        $data = $request->validate([
            'report_type' => ['required', Rule::in(array_keys(CorporateExports::TYPES))],
            'format' => ['required', Rule::in(array_keys(CorporateExports::FORMATS))],
            'filters' => ['sometimes', 'array'],
            'filters.period' => ['sometimes', 'nullable', 'string', 'max:10'],
            'filters.cost_center' => ['sometimes', 'nullable', 'string', 'max:20'],
            'filters.kind' => ['sometimes', 'nullable', Rule::in(['compra', 'pago', 'nota_credito'])],
        ], [
            'report_type.*' => 'Elige el reporte: compras, movimientos, centro_costo, viajeros, estado_cuenta o aprobaciones.',
            'format.*' => 'El formato es xlsx, pdf o csv.',
            'filters.*' => 'Revisa los filtros de la exportación.',
        ]);

        return response()->json(['data' => $exports->request($this->member($request), $data)], 202);
    }

    public function export(Request $request, string $code, CorporateExports $exports): JsonResponse|Response
    {
        $member = $this->member($request);
        $export = $exports->find($member, $code);

        if ($request->boolean('download')) {
            return $exports->download($export);
        }

        return response()->json(['data' => $exports->present($export)]);
    }

    private function panel(CorporateMember $member): array
    {
        $account = $member->account;

        return [
            'client' => ['code' => (string) $account->client_code, 'name' => (string) $account->client_name, 'doc' => trim($account->client_doc_type.' '.$account->client_doc_number)],
            'currency' => (string) $account->currency,
            'credit_days' => (int) $account->credit_days,
            'require_approval' => (bool) $account->require_approval,
            'approval_threshold' => $account->approval_threshold,
            'role' => $member->role(),
            'role_label' => CorporateDirectory::ROLES[$member->role()],
            'scope' => $member->scope()->label(),
            'cost_center' => $member->costCenterCode,
            'can' => [
                'statements' => $member->can('statements.view'),
                'statements_manage' => $member->can('statements.manage'),
                'approvals' => $member->can('approvals'),
                'manage' => $member->can('manage'),
                'travelers' => $member->can('travelers.view'),
            ],
            'periods' => CorporatePeriod::options($this->directory->today()),
            'pending_approvals' => $member->can('approvals') ? app(CorporateApprovals::class)->pendingFor($member) : 0,
        ];
    }

    private function period(Request $request): CorporatePeriod
    {
        return CorporatePeriod::parse((string) $request->query('period', ''), $this->directory->today());
    }

    private function member(Request $request): CorporateMember
    {
        return CorporateMember::of($this->user($request));
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
