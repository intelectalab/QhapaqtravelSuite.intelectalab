<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('alter table collab_conversations alter column subject type text');
        DB::statement('alter table collab_message_attachments alter column file_name type text');
    }

    public function down(): void
    {
        DB::statement('alter table collab_conversations alter column subject type varchar(200)');
        DB::statement('alter table collab_message_attachments alter column file_name type varchar(200)');
    }
};
