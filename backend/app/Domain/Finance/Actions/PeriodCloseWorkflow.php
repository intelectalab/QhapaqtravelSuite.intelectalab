<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Finance\Support\Consolidation;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Mail\QueuedMail;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class PeriodCloseWorkflow
{
    public const MANUAL = [
        'fx' => ['label' => 'Tipo de cambio de cierre registrado', 'detail' => 'El TC de cierre de la SBS está registrado y la diferencia cambiaria del periodo, contabilizada.'],
        'aging' => ['label' => 'Cuentas por cobrar vencidas revisadas', 'detail' => 'Se revisó la antigüedad de saldos y la provisión de cobranza dudosa.'],
        'igv' => ['label' => 'Registro de ventas conciliado con el IGV', 'detail' => 'El registro de ventas cuadra con la declaración del IGV del periodo.'],
    ];

    public function __construct(private readonly Consolidation $money, private readonly AuditLogger $audit, private readonly TenantContext $context, private readonly QueuedMail $mail) {}

    public function show(string $period, User $viewer): array
    {
        $this->ensurePeriod($period);
        $close = DB::table('fin_period_closes as p')->leftJoin('iam_users as u', 'u.id', '=', 'p.closed_by')->where('p.period', $period)->first(['p.id', 'p.status', 'p.closed_at', 'p.snapshot', 'u.name as closed_by']);
        $closed = $close?->status === 'cerrado';
        $marks = $close === null ? collect() : DB::table('fin_period_close_checks as c')->leftJoin('iam_users as u', 'u.id', '=', 'c.checked_by')->where('c.period_close_id', $close->id)
            ->get(['c.check_code', 'c.checked_at', 'u.name as checked_by'])->keyBy('check_code');
        $automatic = $closed ? (json_decode((string) $close->snapshot, true)['automatic'] ?? []) : $this->automatic($period);
        $manual = collect(self::MANUAL)->map(fn (array $check, string $code): array => [
            'code' => $code, 'label' => $check['label'], 'detail' => $check['detail'], 'ok' => $marks->has($code),
            'checked_at' => $marks->get($code)?->checked_at, 'checked_by' => $marks->get($code)?->checked_by,
        ])->values()->all();
        $checks = [...$automatic, ...$manual];

        return [
            'period' => $period,
            'label' => ucfirst(Carbon::parse("{$period}-01")->locale('es')->isoFormat('MMMM [de] YYYY')),
            'status' => $closed ? 'cerrado' : 'abierto',
            'closed_at' => $closed ? $close->closed_at : null,
            'closed_by' => $closed ? $close->closed_by : null,
            'automatic' => $automatic,
            'manual' => $manual,
            'done' => collect($checks)->where('ok', true)->count(),
            'total' => count($checks),
            'periods' => $this->periods(),
            'can' => ['manage' => $viewer->can('finance.invoicing') && ! $closed, 'close' => $viewer->can('finance.invoicing') && ! $closed && collect($checks)->every(fn (array $check): bool => $check['ok'])],
        ];
    }

    public function mark(string $period, string $check, bool $done, User $actor): void
    {
        DB::transaction(function () use ($period, $check, $done, $actor): void {
            $this->ensurePeriod($period);

            if (! array_key_exists($check, self::MANUAL)) {
                throw ApiException::notFound('Ese control no existe.');
            }

            $close = $this->openPeriod($period, $actor);
            $exists = DB::table('fin_period_close_checks')->where('period_close_id', $close->id)->where('check_code', $check)->exists();

            if ($done && ! $exists) {
                DB::table('fin_period_close_checks')->insert(['id' => (string) Str::uuid7(), 'tenant_id' => $this->context->idOrFail(), 'period_close_id' => $close->id, 'check_code' => $check, 'checked_by' => $actor->getKey(), 'checked_at' => now(), 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey(), 'created_at' => now(), 'updated_at' => now()]);
                $this->audit->log('Cierre contable', $period, 'control_ok', null, self::MANUAL[$check]['label']);
            }

            if (! $done && $exists) {
                DB::table('fin_period_close_checks')->where('period_close_id', $close->id)->where('check_code', $check)->delete();
                $this->audit->log('Cierre contable', $period, 'control_reabierto', self::MANUAL[$check]['label'], null);
            }
        });
    }

    public function close(string $period, User $actor): array
    {
        $result = DB::transaction(function () use ($period, $actor): array {
            $this->ensurePeriod($period);
            $close = $this->openPeriod($period, $actor);
            $state = $this->show($period, $actor);
            $pending = collect([...$state['automatic'], ...$state['manual']])->reject(fn (array $check): bool => $check['ok'])->pluck('label')->all();

            if ($pending !== []) {
                throw ApiException::conflict('FIN-BR-56', 'Aún no se puede cerrar '.mb_strtolower($state['label']).'. Falta: '.mb_strtolower(implode('; ', $pending)).'.', ['pending' => $pending]);
            }

            DB::table('fin_period_closes')->where('id', $close->id)->update([
                'status' => 'cerrado', 'closed_at' => now(), 'closed_by' => $actor->getKey(),
                'snapshot' => json_encode(['automatic' => $state['automatic'], 'manual' => $state['manual']], JSON_UNESCAPED_UNICODE), 'updated_by' => $actor->getKey(), 'updated_at' => now(),
            ]);
            $this->audit->log('Cierre contable', $period, 'cerrar_periodo', 'abierto', 'cerrado');

            return $state;
        });

        $this->notify($result['label'], $actor);

        return $this->show($period, $actor);
    }

    private function automatic(string $period): array
    {
        [$from, $to] = $this->range($period);
        $observed = DB::table('fin_invoices')->where('period', $period)->where('status', 'observado')->count();
        $uninvoiced = DB::table('fin_payments as p')->join('fin_payment_applications as a', 'a.payment_id', '=', 'p.id')
            ->where('p.status', 'aplicado')->whereBetween('p.paid_on', [$from, $to])->whereNull('a.reversed_at')
            ->whereNotExists(fn ($query) => $query->from('fin_invoices as i')->whereColumn('i.receivable_id', 'a.receivable_id')->whereNotIn('i.status', ['rechazado', 'anulado']))
            ->distinct()->count('a.receivable_id');
        $reversals = DB::table('fin_payments as p')->where('p.status', 'revertido')->whereBetween('p.reverted_at', ["{$from} 00:00:00", "{$to} 23:59:59"])
            ->whereExists(fn ($query) => $query->from('fin_invoices as i')->whereColumn('i.reservation_id', 'p.reservation_id')->whereIn('i.doc_type', ['01', '03'])->whereNotIn('i.status', ['rechazado', 'anulado']))
            ->whereNotExists(fn ($query) => $query->from('fin_invoices as n')->whereColumn('n.reservation_id', 'p.reservation_id')->where('n.doc_type', '07')->whereNotIn('n.status', ['rechazado', 'anulado']))
            ->count();
        $lines = DB::table('fin_bank_lines')->whereBetween('value_date', [$from, $to])->where('status', '<>', 'conciliado')->count();

        return [
            ['code' => 'observed', 'label' => 'Sin comprobantes observados', 'ok' => $observed === 0, 'detail' => $observed === 0 ? 'El OSE aceptó todos los comprobantes del periodo.' : ($observed === 1 ? '1 comprobante observado por el OSE.' : "{$observed} comprobantes observados por el OSE."), 'href' => '/finanzas/facturacion'],
            ['code' => 'invoiced', 'label' => 'Cobros aplicados con comprobante', 'ok' => $uninvoiced === 0, 'detail' => $uninvoiced === 0 ? 'Cada cobro del periodo tiene su comprobante.' : ($uninvoiced === 1 ? '1 cuota cobrada sin comprobante.' : "{$uninvoiced} cuotas cobradas sin comprobante."), 'href' => '/finanzas/facturacion'],
            ['code' => 'reversals', 'label' => 'Reversiones con nota de crédito', 'ok' => $reversals === 0, 'detail' => $reversals === 0 ? 'Las reversiones facturadas tienen su nota de crédito.' : ($reversals === 1 ? '1 reversión facturada sin nota de crédito.' : "{$reversals} reversiones facturadas sin nota de crédito."), 'href' => '/finanzas/pagos'],
            ['code' => 'reconciliation', 'label' => 'Conciliación bancaria al día', 'ok' => $lines === 0, 'detail' => $lines === 0 ? 'Todas las líneas del extracto del periodo están conciliadas.' : ($lines === 1 ? '1 línea del extracto sin conciliar.' : "{$lines} líneas del extracto sin conciliar."), 'href' => '/finanzas/conciliacion'],
        ];
    }

    private function openPeriod(string $period, User $actor): object
    {
        $close = DB::table('fin_period_closes')->where('period', $period)->lockForUpdate()->first(['id', 'status']);

        if ($close === null) {
            $id = (string) Str::uuid7();
            DB::table('fin_period_closes')->insert(['id' => $id, 'tenant_id' => $this->context->idOrFail(), 'period' => $period, 'status' => 'abierto', 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey(), 'created_at' => now(), 'updated_at' => now()]);

            return (object) ['id' => $id, 'status' => 'abierto'];
        }

        if ($close->status === 'cerrado') {
            throw ApiException::conflict('FIN-BR-57', 'El periodo ya está cerrado: los ajustes van en el periodo siguiente.');
        }

        return $close;
    }

    private function periods(): array
    {
        $now = $this->money->now()->startOfMonth();
        $closed = DB::table('fin_period_closes')->where('status', 'cerrado')->pluck('period')->flip();

        return collect(range(0, 11))->map(function (int $back) use ($now, $closed): array {
            $month = $now->copy()->subMonths($back);
            $period = $month->format('Y-m');

            return ['period' => $period, 'label' => ucfirst($month->locale('es')->isoFormat('MMMM YYYY')), 'closed' => $closed->has($period)];
        })->all();
    }

    private function range(string $period): array
    {
        $start = Carbon::parse("{$period}-01");

        return [$start->toDateString(), $start->copy()->endOfMonth()->toDateString()];
    }

    private function ensurePeriod(string $period): void
    {
        if (preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $period) !== 1) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'El periodo debe tener el formato AAAA-MM.');
        }

        if ($period > $this->money->now()->format('Y-m')) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'Solo se cierran periodos en curso o pasados.');
        }
    }

    private function notify(string $label, User $actor): void
    {
        $recipients = DB::table('iam_users as u')->join('model_has_roles as m', fn ($join) => $join->on('m.model_id', '=', 'u.id'))->join('roles as r', 'r.id', '=', 'm.role_id')
            ->whereIn('r.name', ['finance', 'tenant_admin'])->whereNull('u.deleted_at')->where('u.status', 'activo')->whereNotNull('u.email')->distinct()->get(['u.email', 'u.name']);

        foreach ($recipients as $user) {
            $this->mail->send((string) $user->email, (string) $user->name, "Periodo {$label} cerrado", "Hola {$user->name}:\n\n{$actor->name} cerró el periodo contable {$label}. Desde ahora no se emiten comprobantes con fecha de ese periodo; los ajustes van con nota de crédito o débito en el periodo siguiente.\n\n{$this->context->tenant()->commercial_name}");
        }
    }
}
