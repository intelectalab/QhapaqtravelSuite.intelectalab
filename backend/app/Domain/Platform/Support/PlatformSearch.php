<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

final class PlatformSearch
{
    public const MIN = 2;

    public const LIMIT = 12;

    private const STATUS = ['activo' => 'Activa', 'prueba' => 'En prueba', 'suspendido' => 'Suspendida', 'open' => 'Por cobrar', 'paid' => 'Pagada', 'failed' => 'En cobranza', 'uncollectible' => 'Incobrable', 'void' => 'Anulada', 'draft' => 'Borrador', 'active' => 'Vigente', 'inactive' => 'Inactivo', 'expired' => 'Vencido'];

    public function search(string $term): array
    {
        $term = trim($term);
        $like = '%'.addcslashes(mb_strtolower($term), '%_\\').'%';
        $db = DB::connection('pgsql_platform');
        $items = [];

        $tenants = $db->table('tenants as t')->leftJoin('plans as p', 'p.id', '=', 't.plan_id')
            ->where(fn (Builder $query) => $this->matches($query, ['t.code', 't.commercial_name', 't.legal_name', 't.ruc', 't.subdomain', 't.admin_email'], $like))
            ->orderBy('t.commercial_name')->limit(self::LIMIT)->get(['t.code', 't.commercial_name', 't.subdomain', 't.status', 'p.name as plan']);
        foreach ($tenants as $row) {
            $items[] = $this->item('tenant', 'Agencia', $row->code, $row->commercial_name, trim(($row->plan ? "Plan {$row->plan} · " : '').(self::STATUS[$row->status] ?? $row->status)." · {$row->subdomain}"), '/plataforma/agencias/'.rawurlencode($row->code), $term);
        }

        $number = "trim(i.series) || '-' || lpad(i.number::text, 8, '0')";
        $invoices = $db->table('platform_invoices as i')->join('tenants as t', 't.id', '=', 'i.tenant_id')
            ->where(fn (Builder $query) => $query->whereRaw("lower({$number}) like ?", [$like])->orWhereRaw('lower(i.number::text) like ?', [$like])->orWhereRaw('lower(t.commercial_name) like ?', [$like]))
            ->orderByDesc('i.issue_date')->limit(self::LIMIT)->get(['i.id', DB::raw("{$number} as code"), 't.commercial_name', 'i.total', 'i.status', 'i.issue_date']);
        foreach ($invoices as $row) {
            $items[] = $this->item('invoice', 'Factura', $row->code, "{$row->commercial_name} · S/ ".number_format((float) $row->total, 2, '.', ' '), (self::STATUS[$row->status] ?? $row->status).' · emitida el '.date('d/m/Y', strtotime((string) $row->issue_date)), '/plataforma/facturacion/facturas/'.rawurlencode((string) $row->id), $term);
        }

        $plans = $db->table('plans')->where(fn (Builder $query) => $this->matches($query, ['code', 'name'], $like))->orderBy('rank')->limit(self::LIMIT)->get(['code', 'name', 'price_month']);
        foreach ($plans as $row) {
            $items[] = $this->item('plan', 'Plan', $row->code, $row->name, 'S/ '.number_format((float) $row->price_month, 0, '.', ' ').' al mes', '/plataforma/planes/'.rawurlencode($row->code), $term);
        }

        $coupons = $db->table('coupons')->where(fn (Builder $query) => $this->matches($query, ['code', 'note'], $like))->orderBy('code')->limit(self::LIMIT)->get(['code', 'note', 'type', 'value', 'status']);
        foreach ($coupons as $row) {
            $discount = $row->type === 'percent' ? rtrim(rtrim(number_format((float) $row->value, 2, '.', ''), '0'), '.').' % de descuento' : 'S/ '.number_format((float) $row->value, 2, '.', ' ').' de descuento';
            $items[] = $this->item('coupon', 'Cupón', $row->code, (string) ($row->note ?: $discount), (self::STATUS[$row->status] ?? $row->status).' · '.$discount, '/plataforma/facturacion/cupones', $term);
        }

        usort($items, fn (array $a, array $b): int => $b['exact'] <=> $a['exact']);

        return array_map(fn (array $item): array => array_diff_key($item, ['exact' => true]), array_slice($items, 0, self::LIMIT));
    }

    private function matches(Builder $query, array $fields, string $like): void
    {
        foreach ($fields as $field) {
            $query->orWhereRaw("lower(coalesce({$field}::text, '')) like ?", [$like]);
        }
    }

    private function item(string $type, string $label, string $code, string $title, string $subtitle, string $href, string $term): array
    {
        return ['type' => $type, 'type_label' => $label, 'code' => $code, 'title' => $title, 'subtitle' => $subtitle, 'href' => $href, 'exact' => mb_strtolower($code) === mb_strtolower($term)];
    }
}
