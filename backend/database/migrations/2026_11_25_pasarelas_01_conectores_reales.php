<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            alter table fin_gateway_accounts drop constraint if exists fin_gateway_accounts_provider_check;
            alter table fin_gateway_accounts add constraint fin_gateway_accounts_provider_check
                check (provider in ('pasarela_local', 'paypal', 'yape', 'plin', 'otro', 'izipay', 'culqi', 'niubiz', 'mercadopago'));

            alter table fin_gateway_accounts
                add column if not exists checked_at timestamptz,
                add column if not exists check_status varchar(12) check (check_status is null or check_status in ('ok', 'error')),
                add column if not exists check_message varchar(200);

            comment on column fin_gateway_accounts.provider is 'Pasarela de la cuenta. izipay, culqi, niubiz y mercadopago tienen conector real (INT-02): la agencia carga sus credenciales y los cobros con tarjeta del sitio, links, portal y tarjetas de regalo salen por esa cuenta.';
            comment on column fin_gateway_accounts.checked_at is 'Última prueba de conexión con la pasarela («Probar conexión» en Finanzas › Pasarelas).';
            SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
            alter table fin_gateway_accounts
                drop column if exists checked_at,
                drop column if exists check_status,
                drop column if exists check_message;

            update fin_gateway_accounts set provider = 'pasarela_local' where provider in ('izipay', 'culqi', 'niubiz', 'mercadopago');
            alter table fin_gateway_accounts drop constraint if exists fin_gateway_accounts_provider_check;
            alter table fin_gateway_accounts add constraint fin_gateway_accounts_provider_check
                check (provider in ('pasarela_local', 'paypal', 'yape', 'plin', 'otro'));
            SQL);
    }
};
