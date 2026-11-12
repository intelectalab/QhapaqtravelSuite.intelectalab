<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use App\Domain\Reports\Support\ReportBranding;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Common\Entity\Style\Color;
use OpenSpout\Common\Entity\Style\Style;
use OpenSpout\Writer\XLSX\Writer;

final class TenantDataExport
{
    public const REPORT_KEY = 'datos_agencia';

    public const MAX_ROWS = 50000;

    public const DATASETS = [
        'crm_clients' => 'Clientes',
        'crm_leads' => 'Leads',
        'crm_opportunities' => 'Oportunidades',
        'quote_quotes' => 'Cotizaciones',
        'booking_reservations' => 'Reservas',
        'booking_reservation_services' => 'Servicios reservados',
        'booking_passengers' => 'Pasajeros',
        'ops_orders' => 'Órdenes de operación',
        'ops_vouchers' => 'Vouchers',
        'fin_receivables' => 'Cuentas por cobrar',
        'fin_payments' => 'Pagos',
        'fin_payables' => 'Cuentas por pagar',
        'fin_invoices' => 'Comprobantes',
        'catalog_products' => 'Productos',
        'catalog_rates' => 'Tarifas',
        'catalog_providers' => 'Proveedores',
    ];

    private const HIDDEN = ['tenant_id', 'password', 'remember_token', 'deleted_at', 'lock_version', 'search_vector'];

    private const HIDDEN_PATTERNS = ['token', 'hash', 'secret', 'encrypted', 'cipher'];

    public function __construct(private readonly TenantContext $context) {}

    public function build(): array
    {
        $agency = ReportBranding::for($this->context->tenant());
        $path = tempnam(sys_get_temp_dir(), 'tdx');
        $writer = new Writer;
        $writer->openToFile($path);
        $header = (new Style)->withFontBold(true)->withFontColor(Color::WHITE)->withBackgroundColor(ltrim(strtoupper($agency['brand']), '#'));
        $counts = [];

        $writer->getCurrentSheet()->setName('Resumen');
        $writer->addRow(Row::fromValuesWithStyle(["{$agency['name']} · Exportación completa de datos"], (new Style)->withFontBold(true)->withFontSize(14)));
        $writer->addRow(Row::fromValues(['Generada el '.now($this->context->timezone())->format('d/m/Y H:i')]));
        $writer->addRow(Row::fromValues([]));
        $writer->addRow(Row::fromValuesWithStyle(['Hoja', 'Registros'], $header));
        $summaryRows = [];

        foreach (self::DATASETS as $table => $label) {
            $columns = $this->columns($table);

            if ($columns === []) {
                continue;
            }

            $writer->addNewSheetAndMakeItCurrent()->setName(mb_substr($label, 0, 31));
            $writer->addRow(Row::fromValuesWithStyle($columns, $header));
            $count = 0;

            DB::table($table)->when(in_array('deleted_at', $this->allColumns($table), true), fn ($query) => $query->whereNull('deleted_at'))
                ->orderBy('id')->limit(self::MAX_ROWS)->select($columns)
                ->chunk(1000, function ($rows) use ($writer, $columns, &$count): void {
                    foreach ($rows as $row) {
                        $writer->addRow(Row::fromValues(array_map(fn (string $column): string|int|float => $this->value($row->{$column}), $columns)));
                        $count++;
                    }
                });

            $counts[$table] = $count;
            $summaryRows[] = [$label, $count];
        }

        $writer->setCurrentSheet($writer->getSheets()[0]);

        foreach ($summaryRows as $line) {
            $writer->addRow(Row::fromValues($line));
        }

        $writer->close();
        $content = (string) file_get_contents($path);
        @unlink($path);

        return ['content' => $content, 'rows' => array_sum($counts), 'counts' => $counts];
    }

    private function columns(string $table): array
    {
        return array_values(array_filter($this->allColumns($table), fn (string $column): bool => ! in_array($column, self::HIDDEN, true)
            && collect(self::HIDDEN_PATTERNS)->every(fn (string $pattern): bool => ! str_contains($column, $pattern))));
    }

    private function allColumns(string $table): array
    {
        return DB::table('information_schema.columns')->where('table_schema', 'public')->where('table_name', $table)->orderBy('ordinal_position')->pluck('column_name')->all();
    }

    private function value(mixed $value): string|int|float
    {
        return match (true) {
            $value === null => '',
            is_bool($value) => $value ? 'sí' : 'no',
            is_int($value), is_float($value) => $value,
            default => mb_substr((string) $value, 0, 32000),
        };
    }
}
