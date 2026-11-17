<?php

declare(strict_types=1);

use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Database\Connection;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const NOTE = 'Vencimiento del vale%';

    public function up(): void
    {
        $pending = $this->candidates('ajuste');
        $db = $this->db();
        $db->statement('alter table fin_gift_card_movements alter column kind type varchar(12)');
        $this->reclassify($db, $pending, 'ajuste', 'vencimiento');
    }

    public function down(): void
    {
        $pending = $this->candidates('vencimiento');
        $db = $this->db();
        $this->reclassify($db, $pending, 'vencimiento', 'ajuste');
        $db->statement('alter table fin_gift_card_movements alter column kind type varchar(10)');
    }

    private function candidates(string $kind): array
    {
        return DB::connection('pgsql_platform')->table('fin_gift_card_movements as m')
            ->join('fin_gift_cards as g', 'g.id', '=', 'm.gift_card_id')
            ->where('m.kind', $kind)->where('m.note', 'like', self::NOTE)
            ->orderBy('m.tenant_id')->orderBy('m.created_at')
            ->get(['m.id', 'm.tenant_id', 'm.note', 'g.code'])
            ->groupBy('tenant_id')->map(fn ($rows) => $rows->all())->all();
    }

    private function reclassify(Connection $db, array $pending, string $from, string $to): void
    {
        if ($pending === []) {
            return;
        }

        $context = app(TenantContext::class);
        $previous = $context->id();
        $audit = app(AuditLogger::class);
        $db->statement('alter table fin_gift_card_movements disable trigger trg_fin_gift_card_movements_append_only');

        foreach ($pending as $tenantId => $rows) {
            $db->select('select app_set_tenant(?::uuid)', [(string) $tenantId]);
            $context->set((string) $tenantId);

            foreach ($rows as $row) {
                $db->table('fin_gift_card_movements')->where('id', $row->id)->where('kind', $from)->update(['kind' => $to]);
                $audit->log('Vale de regalo', (string) $row->code, 'reclasificar_movimiento', $from, $to.' · '.$row->note, connection: $db->getName());
            }
        }

        $db->statement('alter table fin_gift_card_movements enable trigger trg_fin_gift_card_movements_append_only');
        $previous === null ? $context->clear() : $context->set($previous);
    }

    private function db(): Connection
    {
        return DB::connection('pgsql_owner');
    }
};
