<?php

declare(strict_types=1);

namespace App\Domain\Crm\Http\Controllers;

use App\Domain\Crm\Actions\ClientWorkflow;
use App\Domain\Crm\Support\AfterSalesDirectory;
use App\Domain\Crm\Support\ClientDirectory;
use App\Domain\Crm\Support\ClientDuplicates;
use App\Domain\Crm\Support\ClientTabs;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Documents\Actions\ClientDocuments;
use App\Domain\Documents\Support\DocumentStore;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Http\CursorPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CrmContractController
{
    public function trips(Request $request, AfterSalesDirectory $directory): JsonResponse
    {
        $trips = $directory->tripList($this->user($request));

        return response()->json(['data' => $trips, 'meta' => ['total' => $trips->count(), 'without_survey' => $trips->whereNull('survey')->count()]]);
    }

    public function surveys(Request $request, AfterSalesDirectory $directory): JsonResponse
    {
        $filters = CursorPage::filters($request);
        $surveys = $directory->surveyList($this->user($request))
            ->when(isset($filters['category']), fn ($items) => $items->where('category', $filters['category']))
            ->when(isset($filters['channel']), fn ($items) => $items->where('channel_code', $filters['channel']))
            ->when(isset($filters['client']), fn ($items) => $items->filter(fn (array $survey): bool => $survey['client']['code'] === $filters['client']))
            ->values();

        return response()->json(CursorPage::respondItems($request, $surveys->all(), ['stats' => $directory->surveyStats($surveys)]));
    }

    public function cases(Request $request, AfterSalesDirectory $directory): JsonResponse
    {
        $filters = CursorPage::filters($request);
        $search = mb_strtolower($filters['q'] ?? '');
        $cases = $directory->caseList($this->user($request))
            ->when(isset($filters['status']), fn ($items) => $items->whereIn('status', explode(',', $filters['status'])))
            ->when(isset($filters['type']), fn ($items) => $items->where('type_code', $filters['type']))
            ->when($search !== '', fn ($items) => $items->filter(fn (array $case): bool => str_contains(mb_strtolower($case['code'].' '.$case['subject'].' '.($case['client']['name'] ?? '')), $search)))
            ->map(fn (array $case): array => array_diff_key($case, ['log' => true]))
            ->values();

        return response()->json(CursorPage::respondItems($request, $cases->all(), ['statuses' => AfterSalesDirectory::CASE_STATUS]));
    }

    public function showCase(Request $request, string $code, AfterSalesDirectory $directory): JsonResponse
    {
        $user = $this->user($request);
        $case = $directory->caseList($user)->firstWhere('code', $code) ?? throw Portfolio::missing($user, 'crm_cases', $code, 'El caso no existe.', 'Este caso');

        return response()->json(['data' => $case]);
    }

    public function pipelineStages(Request $request): JsonResponse
    {
        return response()->json(CursorPage::respond($request, DB::table('crm_pipeline_stages'), ['sort_order' => 'sort_order', 'name' => 'name', 'default_probability' => 'default_probability'], 'sort_order',
            fn (object $row): array => ['code' => $row->code, 'name' => $row->name, 'default_probability' => (int) $row->default_probability, 'sort_order' => (int) $row->sort_order, 'is_closed' => (bool) $row->is_closed]));
    }

    public function duplicates(Request $request, ClientDuplicates $duplicates): JsonResponse
    {
        $data = $request->validate([
            'doc_type' => ['nullable', 'string', 'max:20'],
            'doc_number' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'string', 'max:190'],
            'phone' => ['nullable', 'string', 'max:40'],
            'exclude' => ['nullable', 'string', 'max:30'],
        ], ['*' => 'Revisa los datos de búsqueda de duplicados.']);
        $exclude = isset($data['exclude']) ? DB::table('crm_clients')->where('code', $data['exclude'])->value('id') : null;
        $hard = $duplicates->hard($data['doc_type'] ?? null, $data['doc_number'] ?? null, $exclude);
        $soft = $duplicates->soft($data['email'] ?? null, $data['phone'] ?? null, $exclude);

        return response()->json(['data' => [
            'hard' => $hard ? ['code' => $hard->code, 'name' => $hard->name, 'rule' => 'CRM-BR-16'] : null,
            'soft' => array_map(fn (array $match): array => [...$match, 'rule' => 'CRM-BR-17'], $soft),
        ], 'meta' => ['blocking' => $hard !== null, 'matches' => count($soft) + ($hard ? 1 : 0)]]);
    }

    public function invoicePreview(Request $request, string $code, string $id, ClientDirectory $directory, ClientDocuments $documents, DocumentStore $store, AuditLogger $audit): Response|JsonResponse
    {
        $client = $this->client($request, $code, $directory);
        $only = ClientTabs::partialFor($client, $this->user($request));
        $invoice = DB::table('fin_invoices as i')->leftJoin('booking_reservations as r', 'r.id', '=', 'i.reservation_id')->where('i.client_id', $client->id)
            ->where(Str::isUuid($id) ? 'i.id' : 'i.number', $id)->when($only, fn ($query) => $query->where('r.owner_id', $only))->first(['i.*'])
            ?? throw ApiException::notFound('El comprobante no existe.');
        $documents->printableInvoice($invoice);
        $response = $store->respond($documents->generate(ClientDocuments::INVOICE, (string) $invoice->id), $request);
        $audit->log('Comprobante', (string) $invoice->number, 'solicitar_pdf', null, "Cliente {$client->code}");

        return $response;
    }

    public function voucherPreview(Request $request, string $code, string $id, ClientDirectory $directory, ClientDocuments $documents, DocumentStore $store): Response|JsonResponse
    {
        $client = $this->client($request, $code, $directory);
        $only = ClientTabs::partialFor($client, $this->user($request));
        $voucher = DB::table('ops_vouchers as v')->join('booking_reservations as r', 'r.id', '=', 'v.reservation_id')->where('r.client_id', $client->id)
            ->where(Str::isUuid($id) ? 'v.id' : 'v.code', $id)->when($only, fn ($query) => $query->where('r.owner_id', $only))->first(['v.*'])
            ?? throw ApiException::notFound('El voucher no existe.');
        $documents->liveVoucher($voucher);

        return $store->respond($documents->generate(ClientDocuments::VOUCHER, (string) $voucher->id), $request);
    }

    public function reassign(Request $request, string $code, ClientWorkflow $workflow, ClientDirectory $directory): JsonResponse
    {
        $data = $request->validate([
            'owner_id' => ['required', 'uuid'],
            'note' => ['nullable', 'string', 'max:300'],
        ], ['owner_id.*' => 'Elige el nuevo responsable.', 'note.*' => 'La nota admite hasta 300 caracteres.']);
        $user = $this->user($request);
        $workflow->reassign($code, $data['owner_id'], trim((string) ($data['note'] ?? '')) ?: null, $user);

        return response()->json(['data' => $directory->find($user, $code)]);
    }

    private function client(Request $request, string $code, ClientDirectory $directory): object
    {
        $user = $this->user($request);

        return $directory->record($user, $code) ?? throw Portfolio::missing($user, 'crm_clients', $code, 'El cliente no existe.', 'Este cliente');
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
