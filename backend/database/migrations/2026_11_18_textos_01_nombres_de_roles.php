<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const NAMES = [
        'tenant_admin' => ['Tenant Admin', 'Administración'],
        'manager' => ['Manager', 'Gerencia'],
        'sales' => ['Ventas (Sales)', 'Ventas'],
    ];

    public function up(): void
    {
        foreach (self::NAMES as $role => [$old, $new]) {
            DB::table('roles')->where('name', $role)->where('display_name', $old)->update(['display_name' => $new]);
        }
    }

    public function down(): void
    {
        foreach (self::NAMES as $role => [$old, $new]) {
            DB::table('roles')->where('name', $role)->where('display_name', $new)->update(['display_name' => $old]);
        }
    }
};
