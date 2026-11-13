<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Finance\Support\GrowthFeatureGate;
use App\Domain\Iam\Models\User;
use App\Domain\Integrations\Contracts\AccountingGateway;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Http\CursorPage;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Sequences\SequenceService;
use App\Domain\Shared\Tenancy\TenantContext;
use Brick\Math\BigDecimal;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class AccountingExports
{
    public const RULE = 'R-ACCOUNTING-EXPORT';

    public const TARGETS = ['contasis' => 'Contasis', 'concar' => 'Concar', 'siigo' => 'Siigo', 'quickbooks' => 'QuickBooks', 'xero' => 'Xero', 'csv' => 'CSV genérico'];

    public const CONCEPTS = [
        'venta_gravada' => 'Ventas gravadas',
        'venta_exonerada' => 'Ventas exoneradas',
        'igv' => 'IGV',
        'cxc' => 'Cuentas por cobrar',
        'caja' => 'Caja',
        'banco' => 'Bancos',
        'cxp' => 'Cuentas por pagar',
        'costo_servicio' => 'Costo de servicios',
        'comision' => 'Comisiones',
        'diferencia_cambio' => 'Diferencia de cambio',
        'anticipo' => 'Anticipos de clientes',
        'vale_regalo' => 'Vales de regalo',
    ];

    public const SCOPES = ['ventas' => 'Ventas', 'cobros' => 'Cobros', 'compras' => 'Compras'];

    public const REQUIRED = [
        'ventas' => ['cxc', 'venta_gravada', 'venta_exonerada', 'igv'],
        'cobros' => ['caja', 'banco', 'cxc', 'vale_regalo'],
        'compras' => ['costo_servicio', 'cxp'],
    ];

    public const STATUSES = ['en_cola' => 'En cola', 'generado' => 'Generado', 'enviado' => 'Enviado', 'fallido' => 'Fallido'];

    public function __construct(
        private readonly TenantContext $context,
        private readonly SequenceService $sequences,
        private readonly AuditLogger $audit,
        private readonly AccountingGateway $gateway,
        private readonly GrowthFeatureGate $gate,
    ) {}

    public function mappings(): array
    {
        $this->gate->require(self::RULE);
        $rows = DB::table('fin_account_mappings')->get(['target', 'concept', 'account_code', 'cost_center', 'updated_at'])->groupBy('target');

        return [
            'targets' => collect(self::TARGETS)->map(function (string $label, string $target) use ($rows): array {
                $items = ($rows[$target] ?? collect())->keyBy('concept');

                return [
                    'target' => $target,
                    'label' => $label,
                    'mapped' => $items->count(),
                    'total' => count(self::CONCEPTS),
                    'ready' => collect(self::SCOPES)->keys()->mapWithKeys(fn (string $scope) => [$scope => collect(self::REQUIRED[$scope])->every(fn (string $concept) => $items->has($concept))])->all(),
                    'concepts' => collect(self::CONCEPTS)->map(fn (string $name, string $concept) => [
                        'concept' => $concept,
                        'label' => $name,
                        'account_code' => $items[$concept]->account_code ?? null,
                        'cost_center' => $items[$concept]->cost_center ?? null,
                    ])->values()->all(),
                ];
            })->values()->all(),
            'scopes' => collect(self::SCOPES)->map(fn (string $label, string $key) => ['key' => $key, 'label' => $label, 'concepts' => self::REQUIRED[$key]])->values()->all(),
        ];
    }

    public function saveMappings(array $data, User $actor): array
    {
        $this->gate->require(self::RULE);
        $target = (string) $data['target'];

        DB::transaction(function () use ($data, $target, $actor): void {
            $before = DB::table('fin_account_mappings')->where('target', $target)->pluck('account_code', 'concept')->all();

            foreach ($data['mappings'] as $mapping) {
                $concept = (string) $mapping['concept'];
                $account = trim((string) ($mapping['account_code'] ?? ''));

                if ($account === '') {
                    DB::table('fin_account_mappings')->where('target', $target)->where('concept', $concept)->delete();

                    continue;
                }

                DB::table('fin_account_mappings')->updateOrInsert(
                    ['tenant_id' => $this->context->idOrFail(), 'target' => $target, 'concept' => $concept],
                    ['account_code' => $account, 'cost_center' => trim((string) ($mapping['cost_center'] ?? '')) ?: null, 'updated_by' => $actor->getKey(), 'created_by' => $actor->getKey()],
                );
            }

            $after = DB::table('fin_account_mappings')->where('target', $target)->pluck('account_code', 'concept')->all();
            $this->audit->log('Plan de cuentas', $target, 'actualizar', diff: ['antes' => $before, 'despues' => $after], actor: $actor);
        });

        return $this->mappings();
    }

    public function list(Request $request): array
    {
        $this->gate->require(self::RULE);
        $filters = CursorPage::filters($request);
        $query = DB::table('fin_accounting_exports as e')->leftJoin('iam_users as u', 'u.id', '=', 'e.created_by')
            ->select(['e.id', 'e.code', 'e.target', 'e.period_from', 'e.period_to', 'e.scope', 'e.status', 'e.rows_count', 'e.file_path', 'e.sha256', 'e.error', 'e.created_at', 'u.name as created_by_name']);

        if (isset($filters['target']) && isset(self::TARGETS[$filters['target']])) {
            $query->where('e.target', $filters['target']);
        }

        if (isset($filters['code'])) {
            $query->where('e.code', $filters['code']);
        }

        $withFile = isset($filters['code']) && str_contains((string) $request->query('include', ''), 'file');
        $counts = DB::table('fin_accounting_exports')->select(['status', DB::raw('count(*) as total'), DB::raw('sum(rows_count) as rows_total')])->groupBy('status')->get()->keyBy('status');
        $last = DB::table('fin_accounting_exports')->where('status', 'generado')->orderByDesc('created_at')->first(['code', 'period_to', 'created_at']);

        return CursorPage::respond($request, $query, ['created_at' => 'e.created_at', 'period_from' => 'e.period_from'], '-created_at', fn (object $row): array => $this->row($row, $withFile), [
            'kpis' => [
                'generated' => (int) ($counts['generado']->total ?? 0) + (int) ($counts['enviado']->total ?? 0),
                'failed' => (int) ($counts['fallido']->total ?? 0),
                'rows' => (int) collect($counts)->sum('rows_total'),
                'last' => $last ? ['code' => $last->code, 'period_to' => $last->period_to, 'at' => Carbon::parse((string) $last->created_at)->toIso8601String()] : null,
            ],
            'targets' => collect(self::TARGETS)->map(fn (string $label, string $key) => ['key' => $key, 'label' => $label])->values()->all(),
            'scopes' => collect(self::SCOPES)->map(fn (string $label, string $key) => ['key' => $key, 'label' => $label])->values()->all(),
        ]);
    }

    public function generate(array $data, User $actor): array
    {
        $this->gate->require(self::RULE);
        $target = (string) $data['target'];
        $from = Carbon::parse((string) $data['period_from'])->toDateString();
        $to = Carbon::parse((string) $data['period_to'])->toDateString();
        $scopes = array_values(array_unique($data['scope'] ?? array_keys(self::SCOPES)));

        if ($to < $from) {
            throw ApiException::unprocessable('PERIOD_INVALID', 'La fecha final del periodo debe ser igual o posterior a la inicial.');
        }

        if (Carbon::parse($from)->diffInDays(Carbon::parse($to)) > 366) {
            throw ApiException::unprocessable('PERIOD_TOO_LONG', 'Exporta como máximo un año por archivo.');
        }

        $mapping = DB::table('fin_account_mappings')->where('target', $target)->get(['concept', 'account_code', 'cost_center'])->keyBy('concept');
        $missing = collect($scopes)->flatMap(fn (string $scope) => self::REQUIRED[$scope])->unique()->reject(fn (string $concept) => $mapping->has($concept))->values();

        if ($missing->isNotEmpty()) {
            throw ApiException::unprocessable('ACCOUNT_MAPPING_MISSING', 'Falta la cuenta contable de: '.$missing->map(fn (string $concept) => self::CONCEPTS[$concept])->implode(', ').'. Complétala en el plan de cuentas de '.self::TARGETS[$target].'.', ['missing' => $missing->all()]);
        }

        if (in_array('ventas', $scopes, true) && ! DB::table('fin_invoices')->whereIn('status', ['aceptado', 'observado'])->whereBetween('issue_date', [$from, $to])->exists()) {
            throw ApiException::unprocessable('ACCOUNTING_PERIOD_EMPTY', 'El periodo no tiene comprobantes aceptados u observados por SUNAT. Elige otro periodo o quita «Ventas» del alcance.');
        }

        $entries = [
            ...(in_array('ventas', $scopes, true) ? $this->sales($from, $to, $mapping) : []),
            ...(in_array('cobros', $scopes, true) ? $this->collections($from, $to, $mapping) : []),
            ...(in_array('compras', $scopes, true) ? $this->purchases($from, $to, $mapping) : []),
        ];

        if ($entries === []) {
            throw ApiException::unprocessable('ACCOUNTING_PERIOD_EMPTY', 'El periodo elegido no tiene movimientos para exportar.');
        }

        return DB::transaction(function () use ($target, $from, $to, $scopes, $entries, $actor): array {
            $file = $this->gateway->render($target, $entries);
            $code = $this->sequences->next('accounting_export');
            $path = 'accounting/'.$this->context->idOrFail().'/'.$code.'-'.$target.'-'.$from.'-'.$to.'.'.$file['extension'];
            Storage::disk('local')->put($path, $file['content']);
            $id = (string) Str::uuid7();

            DB::table('fin_accounting_exports')->insert([
                'id' => $id,
                'tenant_id' => $this->context->idOrFail(),
                'code' => $code,
                'target' => $target,
                'period_from' => $from,
                'period_to' => $to,
                'scope' => '{'.implode(',', $scopes).'}',
                'status' => 'generado',
                'rows_count' => count($entries),
                'file_path' => $path,
                'sha256' => hash('sha256', $file['content']),
                'created_by' => $actor->getKey(),
            ]);
            $this->audit->log('Exportación contable', $code, 'exportar', after: self::TARGETS[$target].' · '.$from.' a '.$to.' · '.count($entries).' asientos', actor: $actor);

            $row = DB::table('fin_accounting_exports as e')->leftJoin('iam_users as u', 'u.id', '=', 'e.created_by')->where('e.id', $id)
                ->first(['e.id', 'e.code', 'e.target', 'e.period_from', 'e.period_to', 'e.scope', 'e.status', 'e.rows_count', 'e.file_path', 'e.sha256', 'e.error', 'e.created_at', 'u.name as created_by_name']);

            return $this->row($row, false);
        });
    }

    private function sales(string $from, string $to, $mapping): array
    {
        $entries = [];
        $invoices = DB::table('fin_invoices')->whereIn('status', ['aceptado', 'observado'])->whereBetween('issue_date', [$from, $to])->orderBy('issue_date')->orderBy('number')
            ->get(['number', 'doc_type', 'issue_date', 'customer_name', 'currency', 'fx_rate', 'taxable_amount', 'igv_amount', 'exempt_amount', 'total_amount']);

        foreach ($invoices as $invoice) {
            $credit = str_contains(mb_strtolower((string) $invoice->doc_type), 'nota');
            $glosa = ($credit ? 'Nota de crédito ' : 'Venta ').$invoice->number.' · '.$invoice->customer_name;
            $lines = [
                ['cxc', (string) $invoice->total_amount, true],
                ['venta_gravada', (string) $invoice->taxable_amount, false],
                ['venta_exonerada', (string) $invoice->exempt_amount, false],
                ['igv', (string) $invoice->igv_amount, false],
            ];

            foreach ($lines as [$concept, $amount, $debit]) {
                if (BigDecimal::of($amount)->isZero()) {
                    continue;
                }

                $entries[] = $this->entry('VEN', (string) $invoice->issue_date, (string) $invoice->number, $mapping[$concept], $credit ? ! $debit : $debit, $amount, $glosa, (string) $invoice->currency, $invoice->fx_rate);
            }
        }

        return $entries;
    }

    private function collections(string $from, string $to, $mapping): array
    {
        $entries = [];
        $payments = DB::table('fin_payments as p')->leftJoin('fin_receivables as f', 'f.id', '=', 'p.receivable_id')->leftJoin('booking_reservations as r', 'r.id', '=', 'p.reservation_id')
            ->where('p.kind', 'cobro')->whereIn('p.status', ['confirmado', 'aplicado'])->whereBetween('p.paid_on', [$from, $to])->orderBy('p.paid_on')->orderBy('p.code')
            ->get(['p.code', 'p.method', 'p.paid_on', 'p.amount', 'p.currency', 'p.fx_rate', 'f.code as receivable', 'r.code as reservation']);

        foreach ($payments as $payment) {
            $glosa = 'Cobro '.$payment->code.' · '.($payment->receivable ?? $payment->reservation);
            $source = match (true) {
                $payment->method === 'vale_regalo' => 'vale_regalo',
                $payment->method === 'efectivo' => 'caja',
                default => 'banco',
            };
            $entries[] = $this->entry('COB', (string) $payment->paid_on, (string) $payment->code, $mapping[$source], true, (string) $payment->amount, $glosa, (string) $payment->currency, $payment->fx_rate);
            $entries[] = $this->entry('COB', (string) $payment->paid_on, (string) $payment->code, $mapping['cxc'], false, (string) $payment->amount, $glosa, (string) $payment->currency, $payment->fx_rate);
        }

        return $entries;
    }

    private function purchases(string $from, string $to, $mapping): array
    {
        $entries = [];
        $payables = DB::table('fin_payables as p')->leftJoin('catalog_providers as v', 'v.id', '=', 'p.provider_id')
            ->whereNull('p.deleted_at')->whereNotIn('p.status', ['anulada', 'cancelada', 'borrador'])
            ->whereRaw('p.created_at::date between ? and ?', [$from, $to])->orderBy('p.created_at')->orderBy('p.code')
            ->get(['p.code', 'p.concept', 'p.amount', 'p.currency', 'p.fx_rate', 'p.created_at', 'p.supplier_doc_number', 'v.name as provider']);

        foreach ($payables as $payable) {
            $date = Carbon::parse((string) $payable->created_at)->timezone($this->context->timezone())->toDateString();
            $document = (string) ($payable->supplier_doc_number ?: $payable->code);
            $glosa = 'Compra '.$payable->code.' · '.($payable->provider ?? $payable->concept);
            $entries[] = $this->entry('COM', $date, $document, $mapping['costo_servicio'], true, (string) $payable->amount, $glosa, (string) $payable->currency, $payable->fx_rate);
            $entries[] = $this->entry('COM', $date, $document, $mapping['cxp'], false, (string) $payable->amount, $glosa, (string) $payable->currency, $payable->fx_rate);
        }

        return $entries;
    }

    private function entry(string $journal, string $date, string $document, object $account, bool $debit, string $amount, string $description, string $currency, mixed $fx): array
    {
        $value = (string) Decimal::round2(BigDecimal::of($amount)->abs());

        return [
            'journal' => $journal,
            'date' => Carbon::parse($date)->format('d/m/Y'),
            'document' => $document,
            'account' => (string) $account->account_code,
            'debit' => $debit ? $value : '0.00',
            'credit' => $debit ? '0.00' : $value,
            'description' => mb_substr($description, 0, 120),
            'cost_center' => $account->cost_center,
            'currency' => $currency,
            'fx_rate' => $currency === 'PEN' ? '1.000' : (string) ($fx ?? ''),
        ];
    }

    private function row(object $row, bool $withFile): array
    {
        $scopes = array_values(array_filter(explode(',', trim((string) $row->scope, '{}'))));
        $result = [
            'id' => $row->id,
            'code' => $row->code,
            'target' => $row->target,
            'target_label' => self::TARGETS[$row->target] ?? $row->target,
            'period_from' => $row->period_from,
            'period_to' => $row->period_to,
            'scope' => $scopes,
            'scope_labels' => array_map(fn (string $scope) => self::SCOPES[$scope] ?? $scope, $scopes),
            'status' => $row->status,
            'status_label' => self::STATUSES[$row->status] ?? $row->status,
            'rows_count' => (int) $row->rows_count,
            'sha256' => $row->sha256,
            'error' => $row->error,
            'file_name' => $row->file_path ? basename((string) $row->file_path) : null,
            'created_at' => Carbon::parse((string) $row->created_at)->toIso8601String(),
            'created_by' => $row->created_by_name,
        ];

        if ($withFile && $row->file_path && Storage::disk('local')->exists((string) $row->file_path)) {
            $content = (string) Storage::disk('local')->get((string) $row->file_path);
            $result['file'] = ['name' => basename((string) $row->file_path), 'mime' => str_ends_with((string) $row->file_path, '.txt') ? 'text/plain' : 'text/csv', 'content_base64' => base64_encode($content)];
        }

        return $result;
    }
}
