<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Finance\Actions\GiftCards;
use App\Domain\Finance\Support\DerivedTokens;
use App\Domain\Platform\Models\Tenant;
use Database\Support\SeedsTenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class GrowthBackOfficeSeeder
{
    use SeedsTenant;

    private const ACCOUNTS = [
        'venta_gravada' => ['70321', 'VEN'],
        'venta_exonerada' => ['70322', 'VEN'],
        'igv' => ['40111', null],
        'cxc' => ['12121', null],
        'caja' => ['10111', null],
        'banco' => ['10411', null],
        'cxp' => ['42121', null],
        'costo_servicio' => ['63111', 'OPE'],
        'comision' => ['63211', 'VEN'],
        'diferencia_cambio' => ['77611', null],
        'anticipo' => ['12221', null],
        'vale_regalo' => ['49611', null],
    ];

    private const WAIVER = 'Declaro que participo de forma voluntaria en la actividad, que conozco sus riesgos propios (altura, clima, terreno irregular y esfuerzo físico) y que informé a la agencia cualquier condición de salud relevante. Me comprometo a seguir las indicaciones del guía y a usar el equipo de seguridad entregado. La agencia responde por los servicios contratados, pero no por daños causados por imprudencia propia o por desobedecer las indicaciones del personal.';

    private const LINKS = [
        ['code' => 'LPG-0001', 'receivable' => 'CXC-00714', 'amount' => '910.00', 'methods' => '{card,yape,plin}', 'installments' => 6, 'status' => 'activo', 'sent_via' => 'whatsapp', 'created' => '2026-09-27 11:20', 'expires' => '2026-10-02 23:59', 'by' => 'U07'],
        ['code' => 'LPG-0002', 'receivable' => 'CXC-00712', 'amount' => '480.00', 'methods' => '{card,yape}', 'installments' => 1, 'status' => 'vencido', 'sent_via' => 'email', 'created' => '2026-09-20 09:10', 'expires' => '2026-09-23 23:59', 'by' => 'U04'],
    ];

    private const GIFT_CARDS = [
        ['code' => 'VAL-0001', 'amount' => '500.00', 'balance' => '500.00', 'currency' => 'PEN', 'recipient' => 'Valeria Gómez', 'email' => 'valeria.gomez@correo.pe', 'message' => 'Para tu próxima aventura en Cusco.', 'status' => 'activa', 'created' => '2026-09-12 16:40', 'expires' => '2027-09-12', 'by' => 'U07'],
        ['code' => 'VAL-0002', 'amount' => '150.00', 'balance' => '150.00', 'currency' => 'USD', 'recipient' => 'Sophie Laurent', 'email' => 'sophie.laurent@mail.fr', 'message' => 'Joyeux anniversaire.', 'status' => 'activa', 'created' => '2026-09-25 10:05', 'expires' => '2027-09-25', 'by' => null],
    ];

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        foreach (self::ACCOUNTS as $concept => [$account, $center]) {
            $this->upsert('fin_account_mappings', ['target' => 'contasis', 'concept' => $concept], ['account_code' => $account, 'cost_center' => $center, 'created_by' => $this->userId('U08'), 'updated_by' => $this->userId('U08')]);
        }

        $this->upsert('ops_waiver_templates', ['code' => 'DES-001', 'version' => 1], ['name' => 'Deslinde de actividades de aventura', 'lang' => 'es', 'body' => self::WAIVER, 'requires_guardian_for_minors' => true, 'active' => true, 'created_by' => $this->userId('U05'), 'updated_by' => $this->userId('U05')]);

        foreach (self::LINKS as $link) {
            $receivable = DB::table('fin_receivables')->where('tenant_id', $this->tenant->getKey())->where('code', $link['receivable'])->first(['id', 'reservation_id', 'currency']);

            if ($receivable === null || DB::table('fin_payment_links')->where('tenant_id', $this->tenant->getKey())->where('code', $link['code'])->exists()) {
                continue;
            }

            $id = (string) Str::uuid7();
            $token = DerivedTokens::for('payment-link', $id);
            DB::table('fin_payment_links')->insert([
                'id' => $id,
                'tenant_id' => $this->tenant->getKey(),
                'code' => $link['code'],
                'reservation_id' => $receivable->reservation_id,
                'receivable_id' => $receivable->id,
                'amount' => $link['amount'],
                'currency' => $receivable->currency,
                'methods' => $link['methods'],
                'installments_max' => $link['installments'],
                'provider' => 'fake',
                'url' => 'https://'.($this->tenant->custom_domain ?: $this->tenant->subdomain.'.'.config('sites.domain')).'/pagar/'.$token,
                'token_hash' => DerivedTokens::hash($token),
                'sent_via' => $link['sent_via'],
                'expires_at' => $this->moment($link['expires']),
                'status' => $link['status'],
                'created_by' => $this->userId($link['by']),
                'updated_by' => $this->userId($link['by']),
                'created_at' => $this->moment($link['created']),
            ]);
        }

        foreach (self::GIFT_CARDS as $card) {
            if (DB::table('fin_gift_cards')->where('tenant_id', $this->tenant->getKey())->where('code', $card['code'])->exists()) {
                continue;
            }

            $redeem = implode('-', str_split(mb_strtoupper(substr(hash('sha256', $this->tenant->getKey().$card['code']), 0, 16)), 4));
            $id = (string) Str::uuid7();
            DB::table('fin_gift_cards')->insert([
                'id' => $id,
                'tenant_id' => $this->tenant->getKey(),
                'code' => $card['code'],
                'redeem_code_hash' => GiftCards::hash($redeem),
                'redeem_code_last4' => substr(str_replace('-', '', $redeem), -4),
                'initial_amount' => $card['amount'],
                'balance' => $card['balance'],
                'currency' => $card['currency'],
                'recipient_name' => $card['recipient'],
                'recipient_email' => $card['email'],
                'message' => $card['message'],
                'expires_at' => $this->day($card['expires']),
                'status' => $card['status'],
                'created_by' => $card['by'] ? $this->userId($card['by']) : null,
                'created_at' => $this->moment($card['created']),
            ]);
            DB::table('fin_gift_card_movements')->insert([
                'tenant_id' => $this->tenant->getKey(),
                'gift_card_id' => $id,
                'kind' => 'emision',
                'amount' => $card['amount'],
                'balance_after' => $card['amount'],
                'note' => $card['by'] ? 'Emisión manual' : 'Compra en el sitio',
                'created_by' => $card['by'] ? $this->userId($card['by']) : null,
                'created_at' => $this->moment($card['created']),
            ]);
        }
    }
}
