<?php

declare(strict_types=1);

use Database\Support\KitSchema;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        KitSchema::load('01_platform');
    }

    public function down(): void
    {
        KitSchema::drop('01_platform');
    }
};
