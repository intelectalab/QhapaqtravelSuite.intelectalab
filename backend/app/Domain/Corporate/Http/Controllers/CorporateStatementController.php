<?php

declare(strict_types=1);

namespace App\Domain\Corporate\Http\Controllers;

use App\Domain\Corporate\Actions\CorporateStatements;
use App\Domain\Corporate\Support\CorporateDirectory;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Http\CursorPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

final class CorporateStatementController
{
    public function __construct(private readonly CorporateStatements $statements, private readonly CorporateDirectory $directory) {}

    public function index(Request $request): JsonResponse
    {
        $filters = CursorPage::filters($request);
        $rows = DB::table('fin_corporate_statements')
            ->when(isset($filters['account_id']), fn ($query) => $query->where('account_id', $filters['account_id']))
            ->when(isset($filters['status']), fn ($query) => $query->where('status', $filters['status']))
            ->when(isset($filters['month']) && preg_match('/^\d{4}-\d{2}$/', $filters['month']) === 1, fn ($query) => $query->where('period_start', $filters['month'].'-01'))
            ->orderByDesc('period_start')->orderBy('code')->get();
        $items = $rows->map(fn (object $row): array => $this->statements->present($row))->values()->all();
        $accounts = $this->directory->query()->where('a.status', '<>', 'cerrada')->orderBy('c.name')->get()
            ->map(fn (object $account): array => ['id' => (string) $account->id, 'client_code' => (string) $account->client_code, 'client_name' => (string) $account->client_name, 'currency' => (string) $account->currency, 'statement_auto' => (bool) $account->statement_auto, 'statement_day' => (int) $account->statement_day])->all();

        return response()->json(CursorPage::respondItems($request, $items, [
            'kpis' => [
                'generated' => $rows->where('status', 'generado')->count(),
                'sent' => $rows->where('status', 'enviado')->count(),
                'void' => $rows->where('status', 'anulado')->count(),
                'auto_accounts' => count(array_filter($accounts, fn (array $account): bool => $account['statement_auto'])),
            ],
            'accounts' => $accounts,
        ]));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'account_id' => ['required', 'uuid'],
            'month' => ['required', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/'],
        ], ['account_id.*' => 'Elige la cuenta corporativa.', 'month.*' => 'Indica el mes en formato AAAA-MM.']);
        $account = $this->directory->find($data['account_id'], $this->user($request));

        return response()->json(['data' => $this->statements->present($this->statements->generate($account, $data['month'], $this->user($request)), true)], 201);
    }

    public function show(string $code): JsonResponse
    {
        return response()->json(['data' => $this->statements->present($this->statements->find($code), true)]);
    }

    public function pdf(Request $request, string $code): Response|JsonResponse
    {
        return $this->statements->pdf($this->statements->find($code), $request);
    }

    public function send(Request $request, string $code): JsonResponse
    {
        $data = $request->validate(['recipients' => ['sometimes', 'array', 'min:1', 'max:10'], 'recipients.*' => ['email', 'max:160']], ['recipients.*' => 'Revisa los correos de destino.']);

        return response()->json(['data' => $this->statements->present($this->statements->send($this->statements->find($code), $data['recipients'] ?? null, $this->user($request)), true)]);
    }

    public function void(Request $request, string $code): JsonResponse
    {
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:300']], ['reason.*' => 'El motivo tiene hasta 300 caracteres.']);

        return response()->json(['data' => $this->statements->present($this->statements->void($this->statements->find($code), $data['reason'] ?? null, $this->user($request)), true)]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
