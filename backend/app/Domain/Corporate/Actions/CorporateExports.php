<?php

declare(strict_types=1);

namespace App\Domain\Corporate\Actions;

use App\Domain\Admin\Support\StaffNotices;
use App\Domain\Corporate\Jobs\BuildCorporateExport;
use App\Domain\Corporate\Support\CorporateDirectory;
use App\Domain\Corporate\Support\CorporateLedger;
use App\Domain\Corporate\Support\CorporateMember;
use App\Domain\Corporate\Support\CorporatePeriod;
use App\Domain\Corporate\Support\CorporateReports;
use App\Domain\Corporate\Support\CorporateScope;
use App\Domain\Reports\Support\ReportBranding;
use App\Domain\Reports\Support\ReportFile;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Sequences\SequenceService;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

final class CorporateExports
{
    public const TYPES = ['compras' => 'Compras', 'movimientos' => 'Movimientos', 'centro_costo' => 'Centros de costo', 'viajeros' => 'Viajeros', 'estado_cuenta' => 'Estados de cuenta', 'aprobaciones' => 'Aprobaciones'];

    public const FORMATS = ['xlsx' => 'XLSX', 'pdf' => 'PDF', 'csv' => 'CSV'];

    public const STATUSES = ['en_cola' => 'En cola', 'procesando' => 'Procesando', 'listo' => 'Lista', 'fallido' => 'Fallida', 'vencido' => 'Vencida'];

    public const DAYS = 7;

    public const MAX_QUEUED = 10;

    public function __construct(
        private readonly CorporateDirectory $directory,
        private readonly CorporateReports $reports,
        private readonly SequenceService $sequences,
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
        private readonly ReportFile $files,
        private readonly StaffNotices $notices,
    ) {}

    public function request(CorporateMember $member, array $data): array
    {
        $type = (string) $data['report_type'];

        if (in_array($type, ['estado_cuenta'], true)) {
            $member->require('statements.view', 'Tu rol no ve los estados de cuenta de la empresa.');
        }

        if ($type === 'aprobaciones') {
            $member->require('approvals', 'Tu rol no ve las aprobaciones de la empresa.');
        }

        $period = CorporatePeriod::parse($data['filters']['period'] ?? null, $this->directory->today());
        $queued = DB::table('report_corporate_exports')->where('account_id', $member->account->id)->whereIn('status', ['en_cola', 'procesando'])->count();

        if ($queued >= self::MAX_QUEUED) {
            throw ApiException::unprocessable('CP-08', 'Ya hay '.self::MAX_QUEUED.' exportaciones en preparación para tu empresa. Espera a que terminen e inténtalo de nuevo.');
        }

        $filters = array_filter(['period' => $period->key, 'cost_center' => $data['filters']['cost_center'] ?? null, 'kind' => $data['filters']['kind'] ?? null], fn ($value) => $value !== null && $value !== '');

        $row = DB::transaction(function () use ($member, $type, $data, $filters, $period): object {
            $id = (string) Str::uuid7();
            $code = $this->sequences->next('corporate_export');
            DB::table('report_corporate_exports')->insert([
                'id' => $id,
                'code' => $code,
                'account_id' => $member->account->id,
                'requested_by_portal_user_id' => $member->id(),
                'requested_by_user_id' => $member->portal->user->getKey(),
                'report_type' => $type,
                'filters' => json_encode($filters, JSON_UNESCAPED_UNICODE),
                'format' => $data['format'],
                'status' => 'en_cola',
            ]);
            $this->audit->log('Exportación corporativa', $code, 'exportar', null, self::TYPES[$type].' · '.$period->label.' · '.self::FORMATS[$data['format']]);
            dispatch((new BuildCorporateExport($id))->forTenant($this->context->idOrFail()))->afterCommit();

            return DB::table('report_corporate_exports')->where('id', $id)->first();
        });

        return $this->present($row);
    }

    public function build(string $id): void
    {
        $export = DB::table('report_corporate_exports')->where('id', $id)->first();

        if ($export === null || $export->status !== 'en_cola') {
            return;
        }

        DB::table('report_corporate_exports')->where('id', $id)->update(['status' => 'procesando']);

        try {
            $account = $this->directory->reload((string) $export->account_id);
            $scope = $this->scopeOf($export);
            $filters = (array) json_decode((string) $export->filters, true);
            $period = CorporatePeriod::parse($filters['period'] ?? null, $this->directory->today());
            $report = $this->document($account, (string) $export->report_type, $period, $scope, $filters);
            $format = self::FORMATS[$export->format];
            $content = $this->files->make($format, $report, ReportBranding::for($this->context->tenant()));
            $extension = ReportFile::FORMATS[$format]['extension'];
            $fileName = Str::slug("{$export->code}-".self::TYPES[$export->report_type]."-{$period->key}").".{$extension}";
            $path = "tenants/{$this->context->idOrFail()}/corporate-exports/{$fileName}";
            $disk = (string) config('filesystems.default');
            Storage::disk($disk)->put($path, $content);

            $documentId = (string) DB::table('sys_documents')->insertGetId([
                'doc_type' => 'exportacion_corporativa',
                'entity_type' => 'report_corporate_exports',
                'entity_id' => $export->id,
                'version' => 1,
                'storage_disk' => $disk,
                'storage_path' => $path,
                'file_name' => $fileName,
                'mime_type' => explode(';', ReportFile::FORMATS[$format]['mime'])[0],
                'size_bytes' => strlen($content),
                'sha256' => hash('sha256', $content),
                'generated_by_job' => 'BuildCorporateExport',
                'created_by' => $export->requested_by_user_id,
            ], 'id');

            DB::table('report_corporate_exports')->where('id', $id)->update([
                'status' => 'listo',
                'row_count' => count($report['table']['rows']),
                'document_id' => $documentId,
                'completed_at' => now(),
                'expires_at' => now()->addDays(self::DAYS),
                'error' => null,
            ]);

            $this->notices->toUser($export->requested_by_user_id, 'exportacion.lista', "Tu exportación {$export->code} está lista", self::TYPES[$export->report_type]." · {$period->label} en {$format}. Disponible por ".self::DAYS.' días en Panel corporativo.', 'Exportación corporativa', (string) $export->id);
        } catch (Throwable $e) {
            DB::table('report_corporate_exports')->where('id', $id)->update(['status' => 'fallido', 'error' => mb_substr($e->getMessage(), 0, 500)]);
            report($e);
        }
    }

    public function list(CorporateMember $member): array
    {
        $this->expire($member->account->id);

        return DB::table('report_corporate_exports')->where('account_id', $member->account->id)->where('requested_by_portal_user_id', $member->id())
            ->orderByDesc('created_at')->limit(30)->get()->map(fn (object $row): array => $this->present($row))->values()->all();
    }

    public function find(CorporateMember $member, string $code): object
    {
        $this->expire($member->account->id);

        return DB::table('report_corporate_exports')->where('account_id', $member->account->id)->where('requested_by_portal_user_id', $member->id())->where('code', $code)->first()
            ?? throw ApiException::notFound('No encontramos esa exportación entre las tuyas.');
    }

    public function download(object $export): Response
    {
        if ($export->status !== 'listo' || $export->document_id === null) {
            throw ApiException::conflict('CP-08', $export->status === 'vencido' ? 'La exportación venció. Pide una nueva.' : 'La exportación aún no está lista.');
        }

        $document = DB::table('sys_documents')->where('id', $export->document_id)->first() ?? throw ApiException::notFound('No encontramos el archivo de la exportación.');
        $this->audit->log('Exportación corporativa', (string) $export->code, 'descargar', null, (string) $document->file_name);

        return new Response((string) Storage::disk((string) $document->storage_disk)->get((string) $document->storage_path), 200, [
            'Content-Type' => (string) $document->mime_type,
            'Content-Disposition' => 'attachment; filename="'.Str::ascii((string) $document->file_name).'"',
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function present(object $row): array
    {
        $filters = (array) json_decode((string) $row->filters, true);

        return [
            'code' => (string) $row->code,
            'report_type' => (string) $row->report_type,
            'report_label' => self::TYPES[$row->report_type] ?? (string) $row->report_type,
            'format' => (string) $row->format,
            'format_label' => self::FORMATS[$row->format] ?? (string) $row->format,
            'filters' => $filters,
            'status' => (string) $row->status,
            'status_label' => self::STATUSES[$row->status] ?? (string) $row->status,
            'row_count' => $row->row_count === null ? null : (int) $row->row_count,
            'requested_at' => $row->created_at,
            'completed_at' => $row->completed_at,
            'expires_at' => $row->expires_at,
            'error' => $row->status === 'fallido' ? 'No pudimos preparar el archivo. Pide la exportación de nuevo.' : null,
            'download_path' => $row->status === 'listo' ? "/portal/client/corporate/exports/{$row->code}?download=1" : null,
        ];
    }

    private function expire(string $accountId): void
    {
        DB::table('report_corporate_exports')->where('account_id', $accountId)->where('status', 'listo')->where('expires_at', '<', now())->update(['status' => 'vencido']);
    }

    private function scopeOf(object $export): CorporateScope
    {
        $member = $export->requested_by_portal_user_id ? DB::table('crm_corporate_portal_users')->where('id', $export->requested_by_portal_user_id)->first() : null;

        if ($member === null) {
            return CorporateScope::all();
        }

        return match ($member->portal_role) {
            'aprobador' => new CorporateScope(costCenter: (string) (DB::table('crm_corporate_cost_centers')->where('id', $member->cost_center_id)->value('code') ?? '—')),
            'viajero' => new CorporateScope(traveler: CorporateLedger::normalize((string) ($member->traveler_id ? DB::table('crm_corporate_travelers')->where('id', $member->traveler_id)->value('full_name') : $member->full_name))),
            default => CorporateScope::all(),
        };
    }

    private function document(object $account, string $type, CorporatePeriod $period, CorporateScope $scope, array $filters): array
    {
        $currency = (string) $account->currency;
        [$columns, $rows, $kpis] = match ($type) {
            'compras' => $this->purchasesTable($account, $period, $scope, $filters),
            'movimientos' => $this->movementsTable($account, $period, $scope, $filters),
            'centro_costo' => $this->centersTable($account, $period, $scope),
            'viajeros' => $this->travelersTable($account, $period, $scope),
            'estado_cuenta' => $this->statementsTable($account, $period),
            default => $this->approvalsTable($account, $period, $scope),
        };

        return [
            'title' => self::TYPES[$type].' · '.$account->client_name,
            'scope' => 'tenant',
            'filters' => ['from' => $period->from, 'to' => $period->to, 'label' => $period->label.($scope->label() ? ' · '.$scope->label() : '').' · '.$currency, 'sede' => null],
            'kpis' => $kpis,
            'table' => ['columns' => $columns, 'rows' => $rows, 'totals' => null],
            'charts' => [],
        ];
    }

    private function purchasesTable(object $account, CorporatePeriod $period, CorporateScope $scope, array $filters): array
    {
        $rows = collect($this->reports->purchases($account, $period, $scope))
            ->when(isset($filters['cost_center']), fn ($items) => $items->filter(fn (array $row): bool => collect($row['allocations'])->contains('cost_center', $filters['cost_center'])))
            ->map(fn (array $row): array => ['date' => $row['date'], 'reservation' => $row['reservation'], 'title' => $row['title'], 'travel_from' => $row['travel_from'], 'cost_center' => $row['cost_center'], 'travelers' => count($row['travelers']), 'amount' => $row['amount']])->values()->all();

        return [[
            ['key' => 'date', 'label' => 'Compra', 'format' => 'date'],
            ['key' => 'reservation', 'label' => 'Reserva', 'format' => 'text'],
            ['key' => 'title', 'label' => 'Viaje', 'format' => 'text'],
            ['key' => 'travel_from', 'label' => 'Viaja', 'format' => 'date'],
            ['key' => 'cost_center', 'label' => 'Centro de costo', 'format' => 'text'],
            ['key' => 'travelers', 'label' => 'Viajeros', 'format' => 'number'],
            ['key' => 'amount', 'label' => 'Importe', 'format' => 'money'],
        ], $rows, [
            ['label' => 'Compras', 'value' => count($rows), 'format' => 'number', 'hint' => $period->label],
            ['label' => 'Total comprado', 'value' => array_sum(array_map(fn (array $row): float => (float) $row['amount'], $rows)), 'format' => 'money', 'hint' => (string) $account->currency],
        ]];
    }

    private function movementsTable(object $account, CorporatePeriod $period, CorporateScope $scope, array $filters): array
    {
        $data = $this->reports->movements($account, $period, $scope);
        $rows = collect($data['rows'])->reverse()
            ->when(isset($filters['kind']), fn ($items) => $items->where('kind', $filters['kind']))
            ->when(isset($filters['cost_center']), fn ($items) => $items->where('cost_center', $filters['cost_center']))
            ->map(fn (array $row): array => ['date' => $row['date'], 'kind' => $row['kind_label'], 'document' => $row['document'], 'detail' => $row['detail'], 'cost_center' => $row['cost_center'], 'charge' => (float) $row['charge'] > 0 ? $row['charge'] : null, 'credit' => (float) $row['credit'] > 0 ? $row['credit'] : null, 'balance' => $row['balance']])->values()->all();

        return [[
            ['key' => 'date', 'label' => 'Fecha', 'format' => 'date'],
            ['key' => 'kind', 'label' => 'Tipo', 'format' => 'text'],
            ['key' => 'document', 'label' => 'Documento', 'format' => 'text'],
            ['key' => 'detail', 'label' => 'Detalle', 'format' => 'text'],
            ['key' => 'cost_center', 'label' => 'C. costo', 'format' => 'text'],
            ['key' => 'charge', 'label' => 'Cargo', 'format' => 'money'],
            ['key' => 'credit', 'label' => 'Abono', 'format' => 'money'],
            ['key' => 'balance', 'label' => 'Saldo', 'format' => 'money'],
        ], $rows, [
            ['label' => 'Saldo inicial', 'value' => $data['opening_balance'], 'format' => 'money', 'hint' => $period->from],
            ['label' => 'Compras', 'value' => $data['totals']['charges'], 'format' => 'money', 'hint' => 'Cargos del período'],
            ['label' => 'Pagos y notas de crédito', 'value' => (float) $data['totals']['payments'] + (float) $data['totals']['credits'], 'format' => 'money', 'hint' => 'Abonos del período'],
            ['label' => 'Saldo final', 'value' => $data['totals']['closing_balance'], 'format' => 'money', 'hint' => $period->to],
        ]];
    }

    private function centersTable(object $account, CorporatePeriod $period, CorporateScope $scope): array
    {
        $summary = $this->reports->summary($account, $period, $scope);
        $rows = array_map(fn (array $row): array => ['code' => $row['code'], 'name' => $row['name'], 'period_amount' => $row['period_amount'], 'year_amount' => $row['year_amount'], 'budget' => $row['budget_amount'], 'used_pct' => $row['used_pct'], 'state' => ['en_rango' => 'En rango', 'alerta' => 'Sobre el 80 %', 'excedido' => 'Excedido', 'sin_presupuesto' => 'Sin presupuesto'][$row['budget_state']]], $summary['cost_centers']);

        return [[
            ['key' => 'code', 'label' => 'Código', 'format' => 'text'],
            ['key' => 'name', 'label' => 'Centro de costo', 'format' => 'text'],
            ['key' => 'period_amount', 'label' => 'Gasto del período', 'format' => 'money'],
            ['key' => 'year_amount', 'label' => 'Acumulado del año', 'format' => 'money'],
            ['key' => 'budget', 'label' => 'Presupuesto', 'format' => 'money'],
            ['key' => 'used_pct', 'label' => 'Uso', 'format' => 'percent'],
            ['key' => 'state', 'label' => 'Estado', 'format' => 'text'],
        ], $rows, [['label' => 'Centros de costo', 'value' => count($rows), 'format' => 'number', 'hint' => $period->label]]];
    }

    private function travelersTable(object $account, CorporatePeriod $period, CorporateScope $scope): array
    {
        $summary = $this->reports->summary($account, $period, $scope, null);

        return [[
            ['key' => 'name', 'label' => 'Viajero', 'format' => 'text'],
            ['key' => 'trips', 'label' => 'Viajes', 'format' => 'number'],
            ['key' => 'amount', 'label' => 'Gasto asignado', 'format' => 'money'],
        ], $summary['travelers'], [['label' => 'Viajeros', 'value' => $summary['kpis']['travelers'], 'format' => 'number', 'hint' => 'El costo de cada compra se reparte en partes iguales entre sus viajeros']]];
    }

    private function statementsTable(object $account, CorporatePeriod $period): array
    {
        $rows = DB::table('fin_corporate_statements')->where('account_id', $account->id)->where('status', '<>', 'anulado')
            ->whereBetween('period_start', [$period->from, $period->to])->orderBy('period_start')->get()
            ->map(fn (object $row): array => ['code' => $row->code, 'month' => substr((string) $row->period_start, 0, 7), 'opening' => $row->opening_balance, 'charges' => $row->charges, 'payments' => $row->payments, 'credits' => $row->credits, 'closing' => $row->closing_balance])->values()->all();

        return [[
            ['key' => 'code', 'label' => 'Estado', 'format' => 'text'],
            ['key' => 'month', 'label' => 'Mes', 'format' => 'text'],
            ['key' => 'opening', 'label' => 'Saldo inicial', 'format' => 'money'],
            ['key' => 'charges', 'label' => 'Compras', 'format' => 'money'],
            ['key' => 'payments', 'label' => 'Pagos', 'format' => 'money'],
            ['key' => 'credits', 'label' => 'Notas de crédito', 'format' => 'money'],
            ['key' => 'closing', 'label' => 'Saldo final', 'format' => 'money'],
        ], $rows, [['label' => 'Estados de cuenta', 'value' => count($rows), 'format' => 'number', 'hint' => $period->label]]];
    }

    private function approvalsTable(object $account, CorporatePeriod $period, CorporateScope $scope): array
    {
        $rows = collect(app(CorporateApprovals::class)->forAccount($account))
            ->filter(fn (array $row): bool => $period->contains(substr((string) $row['requested_at'], 0, 10)))
            ->when($scope->costCenter !== null, fn ($items) => $items->filter(fn (array $row): bool => ($row['cost_center']['code'] ?? null) === $scope->costCenter))
            ->map(fn (array $row): array => ['code' => $row['code'], 'reference' => $row['reference'], 'title' => $row['title'], 'cost_center' => $row['cost_center']['code'] ?? null, 'amount' => $row['amount'], 'status' => $row['status_label'], 'requested_at' => $row['requested_at'], 'reason' => $row['reason']])->values()->all();

        return [[
            ['key' => 'code', 'label' => 'Solicitud', 'format' => 'text'],
            ['key' => 'reference', 'label' => 'Referencia', 'format' => 'text'],
            ['key' => 'title', 'label' => 'Viaje', 'format' => 'text'],
            ['key' => 'cost_center', 'label' => 'C. costo', 'format' => 'text'],
            ['key' => 'amount', 'label' => 'Importe', 'format' => 'money'],
            ['key' => 'status', 'label' => 'Estado', 'format' => 'text'],
            ['key' => 'requested_at', 'label' => 'Solicitada', 'format' => 'datetime'],
            ['key' => 'reason', 'label' => 'Motivo', 'format' => 'text'],
        ], $rows, [['label' => 'Solicitudes', 'value' => count($rows), 'format' => 'number', 'hint' => $period->label]]];
    }
}
