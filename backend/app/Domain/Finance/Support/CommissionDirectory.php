<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

final class CommissionDirectory
{
    public const ELIGIBLE = ['confirmada', 'en_operacion', 'completada', 'pendiente_pago', 'pendiente_proveedor', 'parcial', 'reprogramada'];

    public const PAY_METHODS = [
        'vendedor' => ['Planilla del mes', 'Transferencia BCP'],
        'agencia_b2b' => ['Nota de crédito a cuenta B2B', 'Transferencia BCP'],
        'Bono por meta' => ['Planilla del mes', 'Transferencia BCP'],
    ];

    public const RESERVATION_COLUMNS = ['b.id', 'b.code', 'b.channel', 'b.owner_id', 'b.currency', 'b.fx_rate', 'b.total_amount', 'c.segment_code', 'a.id as agency_id', 'a.commission_pct'];

    public const CONDITIONS = ['directo_ecommerce' => 'Venta directa y e-commerce', 'corporativo_grupos' => 'Corporativo y grupos', 'b2b_convenio' => 'Agencia B2B con convenio'];

    private const KIND_LABELS = ['vendedor' => 'Vendedor', 'agencia_b2b' => 'Agencia B2B', 'Bono por meta' => 'Bono por meta'];

    public function __construct(private readonly Consolidation $money) {}

    public function overview(User $viewer): array
    {
        $rows = DB::table('fin_commissions as m')
            ->leftJoin('booking_reservations as b', 'b.id', '=', 'm.reservation_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'm.beneficiary_user_id')
            ->leftJoin('channel_b2b_agencies as a', 'a.id', '=', 'm.beneficiary_agency_id')
            ->whereNull('m.deleted_at')
            ->orderByDesc('m.created_at')
            ->get(['m.code', 'm.lock_version', 'm.kind', 'm.rule_description', 'm.base_amount', 'm.pct', 'm.amount', 'm.currency', 'm.fx_rate', 'm.status', 'm.approved_at', 'm.paid_at', 'm.payment_method', 'm.payment_ref', 'm.created_at', 'b.code as reservation_code', 'b.title as reservation_title', 'u.name as user_name', 'a.legal_name as agency_name'])
            ->map(fn (object $row): array => [
                'code' => $row->code,
                'lock_version' => (int) $row->lock_version,
                'kind' => $row->kind,
                'kind_label' => self::KIND_LABELS[$row->kind] ?? $row->kind,
                'beneficiary' => $row->user_name ?? $row->agency_name ?? 'Sin beneficiario',
                'rule' => $row->rule_description,
                'base' => (float) $row->base_amount,
                'pct' => (float) $row->pct,
                'amount' => (float) $row->amount,
                'currency' => $row->currency,
                'pen' => $this->money->pen($row->amount, $row->currency, $row->fx_rate),
                'status' => $row->status,
                'approved_at' => $row->approved_at,
                'paid_at' => $row->paid_at,
                'payment' => $row->payment_method ? trim($row->payment_method.' · '.$row->payment_ref, ' ·') : null,
                'created_at' => $row->created_at,
                'reservation' => $row->reservation_code ? ['code' => $row->reservation_code, 'title' => $row->reservation_title] : null,
                'pay_methods' => self::PAY_METHODS[$row->kind] ?? self::PAY_METHODS['vendedor'],
            ])->values();

        return [
            'rows' => $rows,
            'kpis' => collect(['calculada', 'aprobada', 'pagada'])->mapWithKeys(fn (string $status): array => [$status => [
                'count' => $rows->where('status', $status)->count(),
                'pen' => round($rows->where('status', $status)->sum('pen'), 2),
            ]])->all() + ['pending_reservations' => $this->pendingReservations()],
            'by_beneficiary' => $rows->groupBy('beneficiary')
                ->map(fn ($items, string $name): array => ['name' => $name, 'kind' => $items->first()['kind_label'], 'pen' => round($items->sum('pen'), 2), 'count' => $items->count(),
                    'calculated' => round($items->where('status', 'calculada')->sum('pen'), 2), 'approved' => round($items->where('status', 'aprobada')->sum('pen'), 2), 'paid' => round($items->where('status', 'pagada')->sum('pen'), 2)])
                ->sortByDesc('pen')->values(),
            'rules' => CommissionRules::list(),
            'can' => [
                'approve' => $viewer->can('finance.commissions'),
                'operate' => $viewer->can('finance.commissions') && $viewer->can('finance.payments.register'),
                'rules' => $viewer->can('finance.commissions') && $viewer->can('finance.payments.register'),
            ],
        ];
    }

    public function pendingReservations(): int
    {
        return $this->eligibleReservations()->count();
    }

    public function eligibleReservations(): Builder
    {
        return $this->reservations()
            ->whereIn('b.status', self::ELIGIBLE)
            ->where(fn ($query) => $query->where(fn ($seller) => $seller->where('b.channel', '<>', 'B2B')->whereNotNull('b.owner_id'))->orWhereNotNull('a.id'))
            ->whereNotExists(fn ($query) => $query->from('fin_commissions as m')->whereColumn('m.reservation_id', 'b.id')->whereNull('m.deleted_at'));
    }

    public function reservations(): Builder
    {
        return DB::table('booking_reservations as b')
            ->join('crm_clients as c', 'c.id', '=', 'b.client_id')
            ->leftJoin('channel_b2b_agencies as a', fn ($join) => $join->on('a.crm_client_id', '=', 'b.client_id')->whereNull('a.deleted_at'))
            ->whereNull('b.deleted_at');
    }
}
