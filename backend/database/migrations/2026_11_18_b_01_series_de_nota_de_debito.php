<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $credit = DB::connection('pgsql_platform')->table('fin_document_series')->where('doc_type', '07')->where('series', 'like', '_C%')->get(['tenant_id', 'series', 'sede_id']);

        if ($credit->isEmpty()) {
            return;
        }

        $db = DB::connection('pgsql_owner');

        foreach ($credit->groupBy('tenant_id') as $tenantId => $rows) {
            $db->select('select app_set_tenant(?::uuid)', [(string) $tenantId]);

            foreach ($rows as $row) {
                $series = substr((string) $row->series, 0, 1).'D'.substr((string) $row->series, 2);

                if ($db->table('fin_document_series')->where('tenant_id', $tenantId)->where('series', $series)->exists()) {
                    continue;
                }

                $db->table('fin_document_series')->insert(['tenant_id' => $tenantId, 'doc_type' => '08', 'series' => $series, 'next_number' => 1, 'active' => true, 'sede_id' => $row->sede_id]);
            }
        }
    }

    public function down(): void
    {
        $db = DB::connection('pgsql_owner');
        $used = $db->table('fin_invoices')->where('doc_type', '08')->distinct()->pluck('series')->all();
        $db->table('fin_document_series')->where('doc_type', '08')->where('next_number', 1)->whereNotIn('series', $used)->delete();
    }
};
