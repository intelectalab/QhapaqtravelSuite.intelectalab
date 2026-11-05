<?php

declare(strict_types=1);

use Database\Support\KitSchema;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        KitSchema::load('20_fase1');
        KitSchema::load('90_rls');
    }

    public function down(): void
    {
        KitSchema::drop('20_fase1');
    }
};
