<?php

declare(strict_types=1);

namespace App\Domain\Reports\Support;

use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class ProcessMap
{
    public function __construct(private readonly TenantContext $context) {}

    public function build(User $viewer): array
    {
        $today = Carbon::now($this->context->timezone())->toDateString();
        $leads = Portfolio::scope(DB::table('crm_leads')->whereNull('deleted_at'), $viewer, 'owner_id')->pluck('status')->countBy();
        $opportunities = Portfolio::scope(DB::table('crm_opportunities')->whereNull('deleted_at'), $viewer, 'owner_id')->get(['stage', 'amount', 'currency', 'probability']);
        $quotes = Portfolio::scope(DB::table('quote_quotes')->whereNull('deleted_at'), $viewer, 'owner_id')->pluck('status')->countBy();
        $reservations = Portfolio::scope(DB::table('booking_reservations')->whereNull('deleted_at'), $viewer, 'owner_id')->get(['id', 'status', 'travel_from', 'travel_to']);
        $orders = DB::table('ops_orders')->whereNull('deleted_at')->whereIn('reservation_id', $reservations->pluck('id'))->pluck('status')->countBy();
        $receivables = Portfolio::scope(DB::table('fin_receivables as f')->join('crm_clients as c', 'c.id', '=', 'f.client_id')->whereNull('f.deleted_at'), $viewer, 'c.owner_id')
            ->where('f.status', '<>', 'cancelada')->get(['f.status', 'f.amount', 'f.paid_amount', 'f.fx_rate', 'f.due_date']);
        $pending = fn (object $row): float => ((float) $row->amount - (float) $row->paid_amount) * (float) ($row->fx_rate ?: 1);
        $openReceivables = $receivables->where('status', '<>', 'pagada');
        $overdue = $openReceivables->filter(fn (object $row): bool => $row->status === 'vencida' || $row->due_date < $today);
        $openOpps = $opportunities->whereNotIn('stage', ['ganada', 'perdida']);
        $traveling = $reservations->filter(fn (object $row): bool => $row->status !== 'cancelada' && $row->travel_from <= $today && $row->travel_to >= $today);
        $sum = fn (array $keys, $counts): int => (int) collect($keys)->sum(fn (string $key): int => (int) ($counts[$key] ?? 0));

        $stages = [
            [
                'id' => 'lead',
                'title' => 'Lead',
                'description' => 'Contacto interesado que aún no se califica.',
                'href' => '/crm/leads',
                'value' => $sum(['nuevo', 'contactado', 'calificado'], $leads),
                'value_label' => 'en gestión',
                'facts' => [['label' => 'Nuevos', 'value' => (int) ($leads['nuevo'] ?? 0)], ['label' => 'Calificados', 'value' => (int) ($leads['calificado'] ?? 0)], ['label' => 'Convertidos', 'value' => (int) ($leads['convertido'] ?? 0)]],
                'alert' => ($leads['nuevo'] ?? 0) > 0 ? ($leads['nuevo'].' sin primer contacto') : null,
            ],
            [
                'id' => 'opportunity',
                'title' => 'Oportunidad',
                'description' => 'Negocio en curso con monto y fecha de cierre.',
                'href' => '/crm/oportunidades',
                'value' => $openOpps->count(),
                'value_label' => 'abiertas',
                'facts' => [['label' => 'En negociación', 'value' => $openOpps->where('stage', 'negociacion')->count()], ['label' => 'Ganadas', 'value' => $opportunities->where('stage', 'ganada')->count()], ['label' => 'Perdidas', 'value' => $opportunities->where('stage', 'perdida')->count()]],
                'alert' => null,
            ],
            [
                'id' => 'quote',
                'title' => 'Cotización',
                'description' => 'Propuesta con precios y versión enviada al cliente.',
                'href' => '/cotizaciones',
                'value' => $sum(['borrador', 'enviada', 'vista', 'negociacion'], $quotes),
                'value_label' => 'abiertas',
                'facts' => [['label' => 'Enviadas o vistas', 'value' => $sum(['enviada', 'vista'], $quotes)], ['label' => 'Aprobadas', 'value' => $sum(['aprobada', 'convertida'], $quotes)], ['label' => 'Vencidas', 'value' => (int) ($quotes['vencida'] ?? 0)]],
                'alert' => DB::table('quote_internal_approvals')->where('status', 'pendiente')->count() > 0 ? DB::table('quote_internal_approvals')->where('status', 'pendiente')->count().' esperan aprobación interna' : null,
            ],
            [
                'id' => 'reservation',
                'title' => 'Reserva',
                'description' => 'Venta confirmada con servicios, pasajeros y pagos.',
                'href' => '/reservas',
                'value' => $reservations->whereNotIn('status', ['borrador', 'cancelada', 'completada'])->count(),
                'value_label' => 'activas',
                'facts' => [['label' => 'Confirmadas', 'value' => $reservations->where('status', 'confirmada')->count()], ['label' => 'Pendientes', 'value' => $reservations->whereIn('status', ['pendiente_pago', 'pendiente_proveedor', 'pendiente_disponibilidad'])->count()], ['label' => 'Completadas', 'value' => $reservations->where('status', 'completada')->count()]],
                'alert' => DB::table('booking_cancel_requests')->where('status', 'pendiente')->count() > 0 ? 'Anulaciones por aprobar' : null,
            ],
            [
                'id' => 'operation',
                'title' => 'Operación',
                'description' => 'Órdenes operativas, asignaciones y viaje en curso.',
                'href' => '/operaciones',
                'value' => $sum(['planificada', 'pendiente_asignacion', 'asignada', 'confirmada', 'en_ejecucion'], $orders),
                'value_label' => 'órdenes abiertas',
                'facts' => [['label' => 'Sin asignar', 'value' => (int) ($orders['pendiente_asignacion'] ?? 0)], ['label' => 'En ejecución', 'value' => (int) ($orders['en_ejecucion'] ?? 0)], ['label' => 'De viaje hoy', 'value' => $traveling->count()]],
                'alert' => ($orders['pendiente_asignacion'] ?? 0) > 0 ? ($orders['pendiente_asignacion'].' por asignar') : null,
            ],
            [
                'id' => 'collection',
                'title' => 'Cobro',
                'description' => 'Cuentas por cobrar, pagos y saldos vencidos.',
                'href' => '/finanzas/cobros',
                'value' => $openReceivables->count(),
                'value_label' => 'cuentas abiertas',
                'amount' => round($openReceivables->sum($pending), 2),
                'facts' => [['label' => 'Vencidas', 'value' => $overdue->count()], ['label' => 'Pagadas', 'value' => $receivables->where('status', 'pagada')->count()]],
                'alert' => $overdue->isNotEmpty() ? 'S/ '.number_format($overdue->sum($pending), 0, ',', ' ').' vencido' : null,
            ],
        ];

        $leadsTotal = max(1, (int) $leads->except(['duplicado'])->sum());

        return [
            'stages' => $stages,
            'conversion' => [
                'lead_to_opportunity' => round((int) ($leads['convertido'] ?? 0) / $leadsTotal * 100, 1),
                'opportunity_win' => $opportunities->whereIn('stage', ['ganada', 'perdida'])->isEmpty() ? null : round($opportunities->where('stage', 'ganada')->count() / $opportunities->whereIn('stage', ['ganada', 'perdida'])->count() * 100, 1),
                'quote_to_reservation' => (int) $quotes->sum() === 0 ? null : round((int) ($quotes['convertida'] ?? 0) / (int) $quotes->sum() * 100, 1),
            ],
            'scope' => Portfolio::ownOnly($viewer) ? 'own' : 'tenant',
        ];
    }
}
