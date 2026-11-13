<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use Database\Support\SeedsTenant;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

final class GrowthCommerceSeeder
{
    use SeedsTenant;

    private const TEMPLATES = [
        ['cotizacion_lista', 'utility', 'cotizacion', 'aprobada', 'Hola {{nombre}}, tu cotización {{codigo}} está lista. Puedes revisarla aquí: {{enlace}}'],
        ['link_pago_reserva', 'utility', 'link_pago', 'aprobada', 'Hola {{nombre}}, este es tu link de pago por {{monto}} para la reserva {{codigo}}: {{enlace}}'],
        ['recupera_carrito', 'marketing', 'recuperacion', 'aprobada', 'Hola {{nombre}}, tu viaje a {{destino}} sigue reservado unas horas más. Termina tu compra aquí: {{enlace}}. Responde BAJA para no recibir más mensajes.'],
        ['resena_viaje', 'utility', 'resena', 'enviada', 'Hola {{nombre}}, gracias por viajar con nosotros. ¿Nos cuentas cómo te fue? {{enlace}}'],
    ];

    private const RULES = [
        ['PDN-001', 'Última hora', 'anticipacion', ['days_before_lte' => 3], '15.00', 10, true],
        ['PDN-002', 'Temporada alta de julio y agosto', 'temporada', ['from' => '07-01', 'to' => '08-31'], '20.00', 20, true],
        ['PDN-003', 'Ocupación baja', 'ocupacion', ['occupancy_lte' => 0.3], '-10.00', 30, false],
    ];

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        $admin = $this->userId('U01');
        $this->whatsapp($admin);
        $this->recovery($admin);
        $this->pricing($admin);
        $this->ota($admin);
        $this->import($admin);
    }

    private function whatsapp(?string $admin): void
    {
        $account = $this->upsert('collab_channel_accounts', ['channel' => 'whatsapp', 'name' => 'WhatsApp Business'], ['status' => 'sandbox', 'phone_number_id' => '+51 984 120 450', 'created_by' => $admin]);

        foreach (self::TEMPLATES as [$name, $category, $purpose, $status, $body]) {
            preg_match_all('/\{\{([a-z0-9_]+)\}\}/', $body, $found);
            DB::table('collab_whatsapp_templates')->updateOrInsert(['tenant_id' => $this->tenant->getKey(), 'channel_account_id' => $account, 'name' => $name, 'lang' => 'es'], [
                'category' => $category,
                'purpose' => $purpose,
                'body' => $body,
                'variables' => '{'.implode(',', array_unique($found[1])).'}',
                'meta_template_id' => 'wa_tpl_sbx_'.$name,
                'status' => $status,
                'created_by' => $admin,
                'updated_by' => $admin,
            ]);
        }
    }

    private function recovery(?string $admin): void
    {
        $email = DB::table('mkt_templates')->where('tenant_id', $this->tenant->getKey())->where('channel', 'email')->orderBy('code')->value('code');
        $flows = [];

        if ($email !== null) {
            $flows['REC-01'] = $this->upsert('mkt_recovery_flows', ['code' => 'REC-01'], ['name' => 'Carrito abandonado a las 2 horas', 'trigger_kind' => 'cart', 'delay_minutes' => 120, 'channel' => 'email', 'template_ref' => $email, 'max_attempts' => 2, 'include_payment_link' => true, 'active' => true, 'created_by' => $admin, 'updated_by' => $admin]);
        }

        $flows['REC-02'] = $this->upsert('mkt_recovery_flows', ['code' => 'REC-02'], ['name' => 'Cotización sin respuesta a las 48 horas', 'trigger_kind' => 'quote', 'delay_minutes' => 2880, 'channel' => 'whatsapp', 'template_ref' => 'recupera_carrito', 'max_attempts' => 3, 'include_payment_link' => false, 'active' => true, 'created_by' => $admin, 'updated_by' => $admin]);
        $quotes = DB::table('quote_quotes as q')->join('crm_clients as c', 'c.id', '=', 'q.client_id')->where('q.tenant_id', $this->tenant->getKey())->whereNull('q.deleted_at')
            ->whereNotNull('c.phone')->orderBy('q.code')->limit(4)->get(['q.id', 'q.client_id', 'c.phone']);
        $reservation = DB::table('booking_reservations')->where('tenant_id', $this->tenant->getKey())->whereNull('deleted_at')->whereNotIn('status', ['cancelada', 'borrador'])->orderBy('code')->first(['id', 'total_amount']);
        $statuses = ['enviado', 'recuperado', 'programado', 'descartado'];

        foreach ($quotes as $index => $quote) {
            $status = $statuses[$index] === 'recuperado' && $reservation === null ? 'enviado' : $statuses[$index];
            $scheduled = Carbon::now()->subDays(6 - $index);
            DB::table('mkt_recovery_attempts')->updateOrInsert(['tenant_id' => $this->tenant->getKey(), 'flow_id' => $flows['REC-02'], 'quote_id' => $quote->id, 'attempt_no' => 1], [
                'client_id' => $quote->client_id,
                'to_address' => $quote->phone,
                'scheduled_at' => $scheduled,
                'sent_at' => $status === 'programado' ? null : $scheduled,
                'status' => $status,
                'recovered_reservation_id' => $status === 'recuperado' ? $reservation->id : null,
                'recovered_amount' => $status === 'recuperado' ? $reservation->total_amount : null,
            ]);
        }
    }

    private function pricing(?string $admin): void
    {
        foreach (self::RULES as [$code, $name, $basis, $conditions, $adjust, $priority, $active]) {
            $this->upsert('catalog_dynamic_price_rules', ['code' => $code], ['name' => $name, 'basis' => $basis, 'conditions' => json_encode($conditions), 'adjust_pct' => $adjust, 'priority' => $priority, 'active' => $active, 'created_by' => $admin, 'updated_by' => $admin]);
        }
    }

    private function ota(?string $admin): void
    {
        $connection = $this->upsert('channel_ota_connections', ['code' => 'OTA-01'], [
            'ota' => 'viator',
            'name' => 'Viator · cuenta de proveedor',
            'account_ref' => 'SUP-'.strtoupper(substr((string) $this->tenant->getKey(), -6)),
            'credentials_encrypted' => Crypt::encryptString('clave-de-prueba-viator'),
            'webhook_secret_encrypted' => Crypt::encryptString('secreto-de-prueba-viator'),
            'commission_pct' => '20.00',
            'markup_pct' => '10.00',
            'status' => 'conectado',
            'last_sync_at' => Carbon::now()->subHours(3),
            'created_by' => $admin,
            'updated_by' => $admin,
        ]);
        $products = DB::table('catalog_products')->where('tenant_id', $this->tenant->getKey())->whereNull('deleted_at')->where('status', 'ACTIVE')->orderBy('code')->limit(2)->get(['id', 'code']);
        $mappings = [];

        foreach ($products as $index => $product) {
            $mappings[] = $this->upsert('channel_ota_product_mappings', ['connection_id' => $connection, 'product_id' => $product->id], ['ota_product_ref' => 'V-'.(5100 + $index), 'price_mode' => 'markup', 'status' => 'activo', 'last_sync_at' => Carbon::now()->subHours(3), 'created_by' => $admin]);
        }

        if ($mappings === []) {
            return;
        }

        $reservation = DB::table('booking_reservations')->where('tenant_id', $this->tenant->getKey())->whereNull('deleted_at')->whereNotIn('status', ['cancelada', 'borrador'])->orderByDesc('code')->value('id');
        $bookings = [
            ['VIA-88231', $reservation !== null ? 'confirmada' : 'recibida', $reservation, null, '412.00', 2, 12],
            ['VIA-88264', 'rechazada', null, 'Sin cupo para la fecha pedida: se informó a la OTA.', '198.00', 1, 20],
        ];

        foreach ($bookings as [$ref, $status, $reservationId, $error, $gross, $pax, $days]) {
            $this->upsert('channel_ota_bookings', ['connection_id' => $connection, 'ota_booking_ref' => $ref], [
                'mapping_id' => $mappings[0],
                'reservation_id' => $reservationId,
                'payload' => json_encode(['ref' => $ref, 'simulated' => true]),
                'gross_amount' => $gross,
                'net_amount' => number_format((float) $gross * 0.8, 2, '.', ''),
                'currency' => 'USD',
                'travel_date' => Carbon::today()->addDays($days)->toDateString(),
                'pax' => $pax,
                'status' => $status,
                'error' => $error,
                'received_at' => Carbon::now()->subDays(2),
                'processed_at' => Carbon::now()->subDays(2),
            ]);
        }
    }

    private function import(?string $admin): void
    {
        $products = [
            ['key' => 'P1', 'name' => 'City tour Cusco colonial', 'destination' => 'Cusco', 'duration_days' => 1, 'price' => '120', 'currency' => 'PEN', 'confidence' => 0.96, 'created_code' => null],
            ['key' => 'P2', 'name' => 'Montaña de Colores en un día', 'destination' => 'Cusco', 'duration_days' => 1, 'price' => '180', 'currency' => 'PEN', 'confidence' => 0.91, 'created_code' => null],
            ['key' => 'P3', 'name' => 'Cañón del Colca 2 días', 'destination' => 'Arequipa', 'duration_days' => 2, 'price' => '390', 'currency' => 'PEN', 'confidence' => 0.78, 'created_code' => null],
        ];

        $this->upsert('catalog_import_jobs', ['code' => 'IMP-0001'], [
            'source_type' => 'url',
            'source_url' => 'https://proveedor-ejemplo.pe/tours',
            'status' => 'revision',
            'extracted' => json_encode($products, JSON_UNESCAPED_UNICODE),
            'products_detected' => count($products),
            'created_by' => $admin,
            'updated_by' => $admin,
        ]);
    }
}
