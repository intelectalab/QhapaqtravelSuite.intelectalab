<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            alter table fin_treasury_settings
                add column if not exists lock_version integer not null default 1,
                add column if not exists margin_target_pct numeric(5,2) not null default 25.00,
                add column if not exists margin_floor_pct numeric(5,2) not null default 15.00,
                add constraint ck_fin_treasury_settings_margin check (margin_floor_pct >= 0 and margin_floor_pct < margin_target_pct and margin_target_pct <= 100);

            alter table fin_commission_rules
                add column if not exists lock_version integer not null default 1,
                add constraint ck_fin_commission_rules_validity check (valid_to is null or valid_to >= valid_from);

            alter table fin_payables drop constraint if exists fk_fin_payables_scheduled_bank_account_id;
            alter table fin_payables add constraint fk_fin_payables_scheduled_bank_account_id foreign key (scheduled_bank_account_id) references fin_treasury_accounts(id);

            alter table fin_payable_payouts drop constraint if exists fk_fin_payable_payouts_bank_account_id;
            alter table fin_payable_payouts add constraint fk_fin_payable_payouts_bank_account_id foreign key (bank_account_id) references fin_treasury_accounts(id);

            alter table fin_bank_statements drop constraint if exists fk_fin_bank_statements_bank_account_id;
            alter table fin_bank_statements add constraint fk_fin_bank_statements_bank_account_id foreign key (bank_account_id) references fin_treasury_accounts(id);
            SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
            alter table fin_bank_statements drop constraint if exists fk_fin_bank_statements_bank_account_id;
            alter table fin_bank_statements add constraint fk_fin_bank_statements_bank_account_id foreign key (bank_account_id) references fin_bank_accounts(id);

            alter table fin_payable_payouts drop constraint if exists fk_fin_payable_payouts_bank_account_id;
            alter table fin_payable_payouts add constraint fk_fin_payable_payouts_bank_account_id foreign key (bank_account_id) references fin_bank_accounts(id);

            alter table fin_payables drop constraint if exists fk_fin_payables_scheduled_bank_account_id;
            alter table fin_payables add constraint fk_fin_payables_scheduled_bank_account_id foreign key (scheduled_bank_account_id) references fin_bank_accounts(id);

            alter table fin_commission_rules
                drop constraint if exists ck_fin_commission_rules_validity,
                drop column if exists lock_version;

            alter table fin_treasury_settings
                drop constraint if exists ck_fin_treasury_settings_margin,
                drop column if exists margin_floor_pct,
                drop column if exists margin_target_pct,
                drop column if exists lock_version;
            SQL);
    }
};
