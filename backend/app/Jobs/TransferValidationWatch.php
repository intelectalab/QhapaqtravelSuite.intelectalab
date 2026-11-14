<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Admin\Support\StaffNotices;
use App\Domain\Shared\Time\BusinessHours;
use App\Domain\Site\Support\TransferDeadlines;
use App\Domain\Site\Support\TransferProofs;
use App\Domain\Site\Support\TransferSettings;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class TransferValidationWatch extends TenantJob
{
    public const QUEUE = 'notifications';

    private const SOURCES = ['ecommerce', 'portal_cliente'];

    protected function run(): string
    {
        $settings = app(TransferSettings::class)->read();
        $now = CarbonImmutable::now();

        return self::summary([
            $this->escalate($settings, $now),
            $settings['alert_finance'] ? $this->alertUnvalidated($settings, $now) : null,
            $settings['auto_cancel'] ? $this->cancelExpired($settings, $now) : null,
        ], 'Sin transferencias por vigilar');
    }

    private function escalate(array $settings, CarbonImmutable $now): ?string
    {
        $proofs = app(TransferProofs::class);
        $notices = app(StaffNotices::class);
        $reminded = 0;
        $escalated = 0;

        foreach ($this->subjects() as $subject) {
            $stage = $proofs->stage($subject['uploaded_at'], $now);

            if ($stage['business_minutes'] >= $settings['reminder_minutes'] && ! $this->sent(TransferProofs::EVENT_REMINDER, $subject)) {
                $text = "Constancia sin validar · {$subject['label']}";
                $body = "La constancia lleva {$settings['reminder_minutes']} minutos hábiles sin validarse. Revísala en Finanzas › Pagos.";
                $notices->toRoles(TransferProofs::FINANCE, TransferProofs::EVENT_REMINDER, $text, $body, $subject['type'], $subject['id']);
                $proofs->emailRoles(TransferProofs::FINANCE, TransferProofs::EVENT_REMINDER, $text, $body, $subject['type'], $subject['id']);
                $reminded++;
            }

            if ($stage['escalated'] && ! $this->sent(TransferProofs::EVENT_ESCALATED, $subject)) {
                $text = "Transferencia escalada · {$subject['label']}";
                $body = 'Finanzas no validó la constancia en '.($settings['reminder_minutes'] + $settings['escalate_minutes']).' minutos hábiles. Revisa el pago en Finanzas › Pagos.';
                $notices->toRoles(StaffNotices::MANAGERS, TransferProofs::EVENT_ESCALATED, $text, $body, $subject['type'], $subject['id']);
                $proofs->emailRoles(StaffNotices::MANAGERS, TransferProofs::EVENT_ESCALATED, $text, $body, $subject['type'], $subject['id']);
                $escalated++;
            }
        }

        return self::summary([
            $reminded > 0 ? self::plural($reminded, 'recordatorio a Finanzas', 'recordatorios a Finanzas') : null,
            $escalated > 0 ? self::plural($escalated, 'escalamiento a Gerencia', 'escalamientos a Gerencia') : null,
        ], '') ?: null;
    }

    private function alertUnvalidated(array $settings, CarbonImmutable $now): ?string
    {
        $hours = app(BusinessHours::class);
        $notices = app(StaffNotices::class);
        $proofs = app(TransferProofs::class);
        $withProof = DB::table('sys_documents')->where('doc_type', TransferProofs::DOC_TYPE)->where('entity_type', TransferProofs::ENTITY)->pluck('entity_id')->map(fn (mixed $id): string => (string) $id)->all();
        $sent = 0;

        $payments = DB::table('fin_payments as p')->join('booking_reservations as r', 'r.id', '=', 'p.reservation_id')
            ->where('p.kind', 'cobro')->where('p.status', 'pendiente')->whereIn('p.source', self::SOURCES)->where('p.method', '<>', 'tarjeta_e_commerce')
            ->get(['p.id', 'p.code', 'p.amount', 'p.currency', 'p.created_at', 'r.code as reservation_code', 'r.ecom_order_id']);

        foreach ($payments->groupBy(fn (object $p): string => (string) ($p->ecom_order_id ?? $p->id)) as $group) {
            $first = $group->first();

            if ($group->contains(fn (object $p): bool => in_array((string) $p->id, $withProof, true)) || $hours->minutesBetween(CarbonImmutable::parse((string) $group->min('created_at')), $now) < $settings['alert_minutes']) {
                continue;
            }

            $order = $first->ecom_order_id ? DB::table('channel_ecom_orders')->where('id', $first->ecom_order_id)->value('code') : null;
            $subject = ['type' => $order ? 'channel_ecom_order' : 'fin_payment', 'id' => (string) ($first->ecom_order_id ?? $first->id)];

            if ($this->sent(TransferProofs::EVENT_UNVALIDATED, $subject)) {
                continue;
            }

            $label = $order ? "pedido {$order}" : "pago {$first->code} · reserva {$first->reservation_code}";
            $text = 'Pago por validar hace '.intdiv($settings['alert_minutes'], 60)." h hábiles · {$label}";
            $body = 'El cliente informó el pago y aún no se valida contra el banco. Revísalo en Finanzas › Pagos o en la conciliación bancaria.';
            $notices->toRoles(TransferProofs::FINANCE, TransferProofs::EVENT_UNVALIDATED, $text, $body, $subject['type'], $subject['id']);
            $proofs->emailRoles(TransferProofs::FINANCE, TransferProofs::EVENT_UNVALIDATED, $text, $body, $subject['type'], $subject['id']);
            $sent++;
        }

        return $sent > 0 ? self::plural($sent, 'aviso de pago sin validar', 'avisos de pagos sin validar') : null;
    }

    private function cancelExpired(array $settings, CarbonImmutable $now): ?string
    {
        $deadlines = app(TransferDeadlines::class);
        $cancelled = 0;
        $warned = 0;

        foreach (DB::table('channel_ecom_orders')->where('status', 'pago_por_validar')->orderBy('ordered_at')->get() as $order) {
            $cancelAt = $deadlines->cancelAt($order);

            if ($cancelAt === null) {
                continue;
            }

            if ($cancelAt->lte($now)) {
                DB::transaction(function () use ($order, $deadlines, $settings): void {
                    $locked = DB::table('channel_ecom_orders')->where('id', $order->id)->lockForUpdate()->first();

                    if ($locked !== null && $locked->status === 'pago_por_validar' && $deadlines->cancelAt($locked) !== null) {
                        $deadlines->expire($locked, $settings['cancel_hours']);
                    }
                });
                $cancelled++;

                continue;
            }

            if ($cancelAt->subMinutes(TransferSettings::CLIENT_WARNING_MINUTES)->lte($now) && ! $this->sent(TransferDeadlines::EVENT_WARNING, ['type' => 'channel_ecom_order', 'id' => (string) $order->id])) {
                $deadlines->warnClient($order, $cancelAt);
                $warned++;
            }
        }

        return self::summary([
            $warned > 0 ? self::plural($warned, 'aviso al cliente', 'avisos a clientes') : null,
            $cancelled > 0 ? self::plural($cancelled, 'pedido cancelado', 'pedidos cancelados') : null,
        ], '') ?: null;
    }

    private function subjects(): Collection
    {
        $rows = DB::table('sys_documents as d')->join('fin_payments as p', 'p.id', '=', 'd.entity_id')->join('booking_reservations as r', 'r.id', '=', 'p.reservation_id')
            ->leftJoin('channel_ecom_orders as o', 'o.id', '=', 'r.ecom_order_id')
            ->where('d.doc_type', TransferProofs::DOC_TYPE)->where('d.entity_type', TransferProofs::ENTITY)->where('p.status', 'pendiente')
            ->get(['d.created_at', 'p.id as payment_id', 'p.code as payment_code', 'r.code as reservation_code', 'o.id as order_id', 'o.code as order_code']);

        return $rows->groupBy(fn (object $row): string => (string) ($row->order_id ?? $row->payment_id))->map(fn (Collection $group): array => [
            'type' => $group->first()->order_id ? 'channel_ecom_order' : 'fin_payment',
            'id' => (string) ($group->first()->order_id ?? $group->first()->payment_id),
            'label' => $group->first()->order_code ? "pedido {$group->first()->order_code}" : "pago {$group->first()->payment_code} · reserva {$group->first()->reservation_code}",
            'uploaded_at' => (string) $group->min('created_at'),
        ])->values();
    }

    private function sent(string $event, array $subject): bool
    {
        return DB::table('notif_messages')->where('event_code', $event)->where('source_type', $subject['type'])->where('source_id', $subject['id'])->exists();
    }
}
