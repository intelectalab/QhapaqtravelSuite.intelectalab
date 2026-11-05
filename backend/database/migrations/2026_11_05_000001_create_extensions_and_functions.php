<?php

declare(strict_types=1);

use Database\Support\KitSchema;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        KitSchema::load('00_extensions_and_functions');
    }

    public function down(): void
    {
        KitSchema::drop('00_extensions_and_functions');
    }
};
