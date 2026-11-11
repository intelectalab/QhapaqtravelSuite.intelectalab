<?php

declare(strict_types=1);

namespace App\Domain\Reports\Support;

use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Reports\Builders\ClientsReport;
use App\Domain\Reports\Builders\CommercialReport;
use App\Domain\Reports\Builders\FinanceReport;
use App\Domain\Reports\Builders\OperationsReport;
use App\Domain\Reports\Builders\ProvidersReport;
use App\Domain\Reports\Builders\QuotesReport;
use App\Domain\Reports\Builders\ReservationsReport;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;

final class ReportCatalog
{
    private const BUILDERS = [
        'comercial' => CommercialReport::class,
        'cotizaciones' => QuotesReport::class,
        'reservas' => ReservationsReport::class,
        'operaciones' => OperationsReport::class,
        'finanzas' => FinanceReport::class,
        'proveedores' => ProvidersReport::class,
        'clientes' => ClientsReport::class,
    ];

    public function __construct(private readonly TenantContext $context) {}

    public function build(User $viewer, string $report, ?string $period, ?string $sede): array
    {
        ReportTabs::assert($viewer, $report);
        $filters = ReportFilters::make($period, $sede, $this->context->timezone());
        $builder = app(self::BUILDERS[$report]);

        return [
            'key' => $report,
            'title' => ReportTabs::TITLES[$report],
            'filters' => $filters->describe(),
            'scope' => Portfolio::ownOnly($viewer) ? 'own' : 'tenant',
            'tabs' => ReportTabs::for($viewer),
            'periods' => collect(ReportFilters::PERIODS)->map(fn (string $label, string $key): array => ['key' => $key, 'label' => $label])->values()->all(),
            'sedes' => DB::table('iam_sedes')->whereNull('deleted_at')->orderByDesc('is_main')->orderBy('name')->get(['id', 'name'])->all(),
            'can_export' => $viewer->can('reports.export'),
            'variant' => null,
            ...$builder->build($viewer, $filters),
        ];
    }
}
