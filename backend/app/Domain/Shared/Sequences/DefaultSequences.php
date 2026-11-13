<?php

declare(strict_types=1);

namespace App\Domain\Shared\Sequences;

use Illuminate\Support\Facades\DB;

final class DefaultSequences
{
    public const SERIES = [
        'quote' => ['label' => 'Cotización', 'prefix' => 'COT-{Y}-', 'pad' => 5, 'year_reset' => true, 'table' => 'quote_quotes'],
        'reservation' => ['label' => 'Reserva', 'prefix' => 'RES-{Y}-', 'pad' => 6, 'year_reset' => true, 'table' => 'booking_reservations'],
        'receivable' => ['label' => 'Cuenta por cobrar', 'prefix' => 'CXC-', 'pad' => 5, 'year_reset' => false, 'table' => 'fin_receivables'],
        'ops_order' => ['label' => 'Orden operativa', 'prefix' => 'OP-{Y}-', 'pad' => 4, 'year_reset' => true, 'table' => 'ops_orders'],
        'voucher' => ['label' => 'Voucher', 'prefix' => 'VOU-{Y}-', 'pad' => 5, 'year_reset' => true, 'table' => 'ops_vouchers'],
        'payment' => ['label' => 'Pago', 'prefix' => 'PAG-', 'pad' => 5, 'year_reset' => false, 'table' => 'fin_payments'],
        'payable' => ['label' => 'Cuenta por pagar', 'prefix' => 'CXP-', 'pad' => 5, 'year_reset' => false, 'table' => 'fin_payables'],
        'payout' => ['label' => 'Pago a proveedor', 'prefix' => 'PPR-', 'pad' => 4, 'year_reset' => false, 'table' => 'fin_payable_payouts'],
        'commission' => ['label' => 'Comisión', 'prefix' => 'COM-', 'pad' => 4, 'year_reset' => false, 'table' => 'fin_commissions'],
        'treasury_movement' => ['label' => 'Movimiento de tesorería', 'prefix' => 'MOV-', 'pad' => 6, 'year_reset' => false, 'table' => 'fin_treasury_movements'],
        'treasury_account' => ['label' => 'Cuenta de tesorería', 'prefix' => 'CTA-', 'pad' => 2, 'year_reset' => false, 'table' => 'fin_treasury_accounts'],
        'treasury_transfer' => ['label' => 'Transferencia de tesorería', 'prefix' => 'TRF-', 'pad' => 4, 'year_reset' => false, 'table' => 'fin_treasury_transfers'],
        'cash_session' => ['label' => 'Sesión de caja', 'prefix' => 'CJS-', 'pad' => 4, 'year_reset' => false, 'table' => 'fin_cash_sessions'],
        'cash_count' => ['label' => 'Arqueo de caja', 'prefix' => 'ARQ-', 'pad' => 4, 'year_reset' => false, 'table' => 'fin_cash_counts'],
        'cash_replenishment' => ['label' => 'Reposición de caja', 'prefix' => 'REP-', 'pad' => 4, 'year_reset' => false, 'table' => 'fin_cash_replenishments'],
        'bank_line' => ['label' => 'Línea de extracto bancario', 'prefix' => 'BNK-', 'pad' => 1, 'year_reset' => false, 'table' => 'fin_bank_lines'],
        'reconciliation_closure' => ['label' => 'Cierre de conciliación', 'prefix' => 'CON-{Y}-', 'pad' => 3, 'year_reset' => true, 'table' => 'fin_reconciliation_closures'],
        'corporate_approval' => ['label' => 'Aprobación corporativa', 'prefix' => 'APC-', 'pad' => 4, 'year_reset' => false, 'table' => 'booking_corporate_approvals'],
        'corporate_export' => ['label' => 'Exportación corporativa', 'prefix' => 'EXC-', 'pad' => 4, 'year_reset' => false, 'table' => 'report_corporate_exports'],
        'web_order' => ['label' => 'Pedido web', 'prefix' => 'WEB-', 'pad' => 5, 'year_reset' => false, 'table' => 'channel_ecom_orders'],
        'in_trip_offer' => ['label' => 'Oferta en ruta', 'prefix' => 'ITO-', 'pad' => 4, 'year_reset' => false, 'table' => 'booking_in_trip_offers'],
        'ai_content_job' => ['label' => 'Pedido de contenido con IA', 'prefix' => 'IAC-', 'pad' => 4, 'year_reset' => false, 'table' => 'cms_ai_content_jobs'],
        'recovery_flow' => ['label' => 'Flujo de recuperación', 'prefix' => 'REC-', 'pad' => 2, 'year_reset' => false, 'table' => 'mkt_recovery_flows'],
        'catalog_import' => ['label' => 'Importación de productos', 'prefix' => 'IMP-', 'pad' => 4, 'year_reset' => false, 'table' => 'catalog_import_jobs'],
        'dynamic_price_rule' => ['label' => 'Regla de precio dinámico', 'prefix' => 'PDN-', 'pad' => 3, 'year_reset' => false, 'table' => 'catalog_dynamic_price_rules'],
        'ota_connection' => ['label' => 'Conexión con OTA', 'prefix' => 'OTA-', 'pad' => 2, 'year_reset' => false, 'table' => 'channel_ota_connections'],
        'payment_link' => ['label' => 'Link de pago', 'prefix' => 'LPG-', 'pad' => 4, 'year_reset' => false, 'table' => 'fin_payment_links'],
        'gift_card' => ['label' => 'Vale de regalo', 'prefix' => 'VAL-', 'pad' => 4, 'year_reset' => false, 'table' => 'fin_gift_cards'],
        'accounting_export' => ['label' => 'Exportación contable', 'prefix' => 'EXC-', 'pad' => 4, 'year_reset' => false, 'table' => 'fin_accounting_exports'],
        'waiver_template' => ['label' => 'Plantilla de deslinde', 'prefix' => 'DES-', 'pad' => 3, 'year_reset' => false, 'table' => 'ops_waiver_templates'],
        'invoice' => ['label' => 'Factura', 'prefix' => 'F001-', 'pad' => 8, 'year_reset' => false, 'table' => null],
        'receipt' => ['label' => 'Boleta', 'prefix' => 'B001-', 'pad' => 8, 'year_reset' => false, 'table' => null],
    ];

    public function sync(string $tenantId, int $year): array
    {
        $result = [];

        foreach (self::SERIES as $docType => $series) {
            $result[$docType] = $this->ensure($tenantId, $docType, $series['year_reset'] ? (string) $year : 'default', $year);
        }

        return $result;
    }

    public function ensure(string $tenantId, string $docType, string $seriesKey, int $year): int
    {
        $series = self::SERIES[$docType];
        DB::select('select pg_advisory_xact_lock(hashtext(?))', ["{$tenantId}:sys_sequences:{$docType}:{$seriesKey}"]);

        $row = DB::table('sys_sequences')
            ->where('tenant_id', $tenantId)
            ->where('doc_type', $docType)
            ->where('series', $seriesKey)
            ->lockForUpdate()
            ->first(['id', 'prefix', 'next_number']);

        $prefix = $row->prefix ?? str_replace('{Y}', (string) $year, $series['prefix']);
        $next = $this->highestUsed($tenantId, $series['table'], $prefix) + 1;

        if ($row === null && $seriesKey !== 'default') {
            $legacy = DB::table('sys_sequences')->where('tenant_id', $tenantId)->where('doc_type', $docType)->where('series', 'default')->where('prefix', $prefix)->value('next_number');
            $next = max($next, (int) $legacy);
        }

        if ($row === null) {
            DB::table('sys_sequences')->insert([
                'tenant_id' => $tenantId,
                'doc_type' => $docType,
                'label' => $series['label'],
                'series' => $seriesKey,
                'prefix' => $prefix,
                'pad_width' => $series['pad'],
                'next_number' => max(1, $next),
                'year_reset' => $series['year_reset'],
                'updated_at' => now(),
            ]);

            return max(1, $next);
        }

        if ((int) $row->next_number < $next) {
            DB::table('sys_sequences')->where('id', $row->id)->update(['next_number' => $next, 'updated_at' => now()]);
        }

        return max((int) $row->next_number, $next);
    }

    private function highestUsed(string $tenantId, ?string $table, string $prefix): int
    {
        if ($table === null) {
            return 0;
        }

        return (int) DB::table($table)
            ->where('tenant_id', $tenantId)
            ->whereRaw('left(code, cast(? as int)) = ?', [mb_strlen($prefix), $prefix])
            ->whereRaw('substring(code from cast(? as int)) ~ ?', [mb_strlen($prefix) + 1, '^[0-9]+$'])
            ->selectRaw('max(cast(substring(code from cast(? as int)) as bigint)) as n', [mb_strlen($prefix) + 1])
            ->value('n');
    }
}
