<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            alter table fin_gift_cards
                add column if not exists redeem_code_encrypted text,
                add column if not exists delivered_at timestamptz;

            update fin_gift_cards set delivered_at = created_at where delivered_at is null and recipient_email is not null;

            create index if not exists ix_fin_gift_cards_delivery_due on fin_gift_cards (deliver_at) where delivered_at is null and redeem_code_encrypted is not null;

            comment on column fin_gift_cards.redeem_code_encrypted is '[Ampliación v3.0] Código de canje cifrado con la llave de la aplicación solo mientras espera su fecha de entrega (deliver_at). Se borra al enviarlo o al anular el vale; el canje se valida siempre contra redeem_code_hash.';
            comment on column fin_gift_cards.delivered_at is '[Ampliación v3.0] Cuándo salió el correo con el código al destinatario. Nulo si espera su fecha de entrega o no tiene correo.';
            SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
            drop index if exists ix_fin_gift_cards_delivery_due;
            alter table fin_gift_cards drop column if exists redeem_code_encrypted, drop column if exists delivered_at;
            SQL);
    }
};
