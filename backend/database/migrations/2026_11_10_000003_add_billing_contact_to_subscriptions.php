<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            alter table subscriptions
                add column billing_contact varchar(150),
                add column billing_doc_type varchar(10) not null default 'Factura',
                add constraint ck_subscriptions_billing_doc_type check (billing_doc_type in ('Factura', 'Boleta'));
            SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
            alter table subscriptions
                drop constraint if exists ck_subscriptions_billing_doc_type,
                drop column if exists billing_doc_type,
                drop column if exists billing_contact;
            SQL);
    }
};
