<?php

declare(strict_types=1);

namespace App\Domain\Growth\Ota;

use App\Domain\Growth\Shared\GrowthRules;
use App\Domain\Iam\Models\User;
use App\Domain\Integrations\Contracts\OtaConnector;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Http\CursorPage;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Sequences\SequenceService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class OtaChannel
{
    public const OTAS = ['viator' => 'Viator', 'getyourguide' => 'GetYourGuide', 'expedia' => 'Expedia', 'google_ttd' => 'Google Things to Do', 'civitatis' => 'Civitatis', 'otro' => 'Otra OTA'];

    public const STATUSES = ['borrador' => 'Por verificar', 'conectado' => 'Conectado', 'pausado' => 'Pausado', 'error' => 'Con error', 'desconectado' => 'Desconectado'];

    public const PRICE_MODES = ['markup' => 'Margen sobre la tarifa pública', 'fijo' => 'Precio fijo', 'neto' => 'Tarifa neta'];

    public const MAPPING_STATUSES = ['pendiente' => 'Pendiente', 'activo' => 'Activo', 'pausado' => 'Pausado', 'error' => 'Con error'];

    public const BOOKING_STATUSES = ['recibida' => 'Recibida', 'confirmada' => 'Confirmada', 'rechazada' => 'Rechazada', 'cancelada' => 'Cancelada', 'error' => 'Con error'];

    public const PERMISSION = 'channels.ota.manage';

    private const EDITABLE = ['name', 'account_ref', 'commission_pct', 'markup_pct', 'sync_availability'];

    public function __construct(
        private readonly GrowthRules $rules,
        private readonly OtaConnector $connector,
        private readonly SequenceService $sequences,
        private readonly AuditLogger $audit,
    ) {}

    public function connections(): array
    {
        $mappings = DB::table('channel_ota_product_mappings')->groupBy('connection_id')->selectRaw("connection_id, count(*) as total, count(*) filter (where status = 'activo') as active")->get()->keyBy('connection_id');
        $bookings = DB::table('channel_ota_bookings')->groupBy('connection_id')->selectRaw("connection_id, count(*) as total, count(*) filter (where status in ('rechazada','error')) as failed")->get()->keyBy('connection_id');
        $rows = DB::table('channel_ota_connections')->orderBy('code')->get()->map(fn (object $row): array => [
            ...$this->present($row),
            'mappings' => ['total' => (int) ($mappings->get($row->id)->total ?? 0), 'active' => (int) ($mappings->get($row->id)->active ?? 0)],
            'bookings' => ['total' => (int) ($bookings->get($row->id)->total ?? 0), 'failed' => (int) ($bookings->get($row->id)->failed ?? 0)],
        ])->values();

        return [
            'enabled' => $this->rules->enabled('R-OTA-CHANNEL'),
            'kpis' => [
                'connected' => $rows->where('status', 'conectado')->count(),
                'mapped' => (int) $rows->sum('mappings.active'),
                'bookings_30' => DB::table('channel_ota_bookings')->where('received_at', '>=', now()->subDays(30))->count(),
                'errors' => $rows->where('status', 'error')->count() + DB::table('channel_ota_bookings')->whereIn('status', ['rechazada', 'error'])->where('received_at', '>=', now()->subDays(30))->count(),
            ],
            'connections' => $rows->all(),
            'catalogs' => ['otas' => self::OTAS, 'statuses' => self::STATUSES, 'price_modes' => self::PRICE_MODES, 'mapping_statuses' => self::MAPPING_STATUSES, 'booking_statuses' => self::BOOKING_STATUSES],
        ];
    }

    public function create(array $data, User $actor): array
    {
        $this->rules->ensure('R-OTA-CHANNEL', self::PERMISSION);
        $check = $this->connector->verify((string) $data['ota'], (string) ($data['account_ref'] ?? ''), (string) $data['api_key']);

        return DB::transaction(function () use ($data, $check, $actor): array {
            $code = $this->sequences->next('ota_connection');
            DB::table('channel_ota_connections')->insert([
                'id' => (string) Str::uuid7(),
                'code' => $code,
                'ota' => $data['ota'],
                'name' => $data['name'],
                'account_ref' => $data['account_ref'] ?? null,
                'credentials_encrypted' => Crypt::encryptString((string) $data['api_key']),
                'webhook_secret_encrypted' => Crypt::encryptString(Str::random(40)),
                'commission_pct' => (string) ($data['commission_pct'] ?? 0),
                'markup_pct' => (string) ($data['markup_pct'] ?? 0),
                'sync_availability' => (bool) ($data['sync_availability'] ?? true),
                'status' => $check->ok ? 'conectado' : 'borrador',
                'last_error' => $check->ok ? null : $check->message,
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ]);
            $this->audit->log('Conexión OTA', $code, 'crear', null, self::OTAS[$data['ota']].' · '.($check->ok ? 'conectado' : 'credenciales rechazadas'));

            return $this->find($code);
        });
    }

    public function update(string $code, array $data, User $actor): array
    {
        $this->rules->ensure('R-OTA-CHANNEL', self::PERMISSION);

        return DB::transaction(function () use ($code, $data, $actor): array {
            $connection = $this->row($code, true);

            if ($connection->status === 'desconectado') {
                throw ApiException::conflict('OTA-STATUS', 'Una conexión desconectada ya no se edita. Crea una nueva.');
            }

            $values = array_intersect_key($data, array_flip(self::EDITABLE));
            $status = $connection->status;
            $error = $connection->last_error;

            if (isset($data['api_key'])) {
                $check = $this->connector->verify((string) $connection->ota, (string) ($values['account_ref'] ?? $connection->account_ref ?? ''), (string) $data['api_key']);
                $values['credentials_encrypted'] = Crypt::encryptString((string) $data['api_key']);
                $status = $check->ok ? ($status === 'pausado' ? 'pausado' : 'conectado') : 'borrador';
                $error = $check->ok ? null : $check->message;
            }

            if (isset($data['action'])) {
                $status = match ([$data['action'], $status]) {
                    ['pausar', 'conectado'] => 'pausado',
                    ['reanudar', 'pausado'] => 'conectado',
                    ['desconectar', $status] => 'desconectado',
                    default => throw ApiException::conflict('OTA-STATUS', match ($data['action']) {
                        'pausar' => 'Solo se pausa una conexión activa.',
                        default => 'Solo se reanuda una conexión pausada.',
                    }),
                };
            }

            DB::table('channel_ota_connections')->where('id', $connection->id)->update([...$values, 'status' => $status, 'last_error' => $error, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);

            if ($status === 'desconectado') {
                DB::table('channel_ota_product_mappings')->where('connection_id', $connection->id)->where('status', 'activo')->update(['status' => 'pausado', 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            }

            $changes = collect(array_diff_key($values, ['credentials_encrypted' => true]))->filter(fn ($value, string $field): bool => (string) $value !== (string) $connection->{$field})->keys()->all();
            $action = $data['action'] ?? (isset($data['api_key']) ? 'cambiar_credenciales' : 'editar');
            $this->audit->log('Conexión OTA', $code, $action, (string) $connection->status, $status.($changes !== [] ? ' · '.implode(', ', $changes) : ''));

            return $this->find($code);
        });
    }

    public function sync(string $code, User $actor): array
    {
        $this->rules->ensure('R-OTA-CHANNEL', self::PERMISSION);
        $connection = $this->row($code);

        if (! in_array($connection->status, ['conectado', 'error'], true)) {
            throw ApiException::conflict('OTA-STATUS', 'Solo se sincroniza una conexión conectada o con error.');
        }

        $listings = $this->listings((string) $connection->id, (float) $connection->markup_pct);
        $result = $this->connector->pushAvailability((string) $connection->ota, (string) $connection->account_ref, Crypt::decryptString((string) $connection->credentials_encrypted), $listings);

        DB::transaction(function () use ($connection, $result, $listings, $actor, $code): void {
            DB::table('channel_ota_connections')->where('id', $connection->id)->update([
                'status' => $result->ok ? 'conectado' : 'error',
                'last_sync_at' => $result->ok ? now() : $connection->last_sync_at,
                'last_error' => $result->ok ? null : $result->message,
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);

            if ($result->ok) {
                DB::table('channel_ota_product_mappings')->where('connection_id', $connection->id)->whereIn('status', ['pendiente', 'activo', 'error'])
                    ->update(['status' => 'activo', 'last_sync_at' => now(), 'last_error' => null, 'updated_at' => now()]);
            }

            $this->audit->log('Conexión OTA', $code, 'sincronizar', (string) $connection->status, ($result->ok ? 'conectado' : 'error').' · '.count($listings).' productos');
        });

        return [...$this->find($code), 'synced' => $result->ok, 'listings' => count($listings), 'message' => $result->ok ? 'Disponibilidad y precios publicados en la OTA.' : $result->message];
    }

    public function mappings(string $code): array
    {
        $connection = $this->row($code);
        $mapped = DB::table('channel_ota_product_mappings as m')->join('catalog_products as p', 'p.id', '=', 'm.product_id')
            ->where('m.connection_id', $connection->id)->orderBy('p.name')
            ->get(['m.*', 'p.code as product_code', 'p.name as product_name']);

        return [
            'connection' => $this->present($connection),
            'mappings' => $mapped->map(fn (object $row): array => $this->mapping($row))->values()->all(),
            'products' => DB::table('catalog_products')->whereNull('deleted_at')->where('status', 'ACTIVE')->orderBy('name')->limit(500)->get(['code', 'name'])
                ->map(fn (object $row): array => ['value' => $row->code, 'label' => $row->name, 'mapped' => $mapped->contains('product_code', $row->code)])->all(),
        ];
    }

    public function map(string $code, string $product, array $data, User $actor): array
    {
        $this->rules->ensure('R-OTA-CHANNEL', self::PERMISSION);

        return DB::transaction(function () use ($code, $product, $data, $actor): array {
            $connection = $this->row($code);
            $productId = DB::table('catalog_products')->whereNull('deleted_at')->where(Str::isUuid($product) ? 'id' : 'code', $product)->value('id') ?? throw ApiException::notFound('El producto no existe.');

            if (($data['price_mode'] ?? 'markup') === 'fijo' && empty($data['fixed_price'])) {
                throw ApiException::unprocessable('SC-10', 'El precio fijo necesita el monto que verá la OTA.', ['field' => 'fixed_price']);
            }

            $existing = DB::table('channel_ota_product_mappings')->where('connection_id', $connection->id)->where('product_id', $productId)->first();
            $values = [
                'ota_product_ref' => $data['ota_product_ref'],
                'ota_option_ref' => $data['ota_option_ref'] ?? null,
                'price_mode' => $data['price_mode'] ?? 'markup',
                'fixed_price' => ($data['price_mode'] ?? 'markup') === 'fijo' ? (string) Decimal::money((string) $data['fixed_price']) : null,
                'status' => $data['status'] ?? ($existing->status ?? 'pendiente'),
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ];

            if ($existing === null) {
                DB::table('channel_ota_product_mappings')->insert([...$values, 'id' => (string) Str::uuid7(), 'connection_id' => $connection->id, 'product_id' => $productId, 'created_by' => $actor->getKey()]);
            } else {
                DB::table('channel_ota_product_mappings')->where('id', $existing->id)->update($values);
            }

            $productCode = (string) DB::table('catalog_products')->where('id', $productId)->value('code');
            $this->audit->log('Mapeo OTA', "{$code}:{$productCode}", $existing === null ? 'crear' : 'editar', $existing->status ?? null, "{$values['ota_product_ref']} · {$values['price_mode']} · {$values['status']}");

            $row = DB::table('channel_ota_product_mappings as m')->join('catalog_products as p', 'p.id', '=', 'm.product_id')->where('m.connection_id', $connection->id)->where('m.product_id', $productId)
                ->first(['m.*', 'p.code as product_code', 'p.name as product_name']);

            return $this->mapping($row);
        });
    }

    public function bookings(Request $request): array
    {
        $filters = CursorPage::filters($request);
        $query = DB::table('channel_ota_bookings as b')->join('channel_ota_connections as c', 'c.id', '=', 'b.connection_id')
            ->leftJoin('channel_ota_product_mappings as m', 'm.id', '=', 'b.mapping_id')
            ->leftJoin('catalog_products as p', 'p.id', '=', 'm.product_id')
            ->leftJoin('booking_reservations as r', 'r.id', '=', 'b.reservation_id')
            ->when($filters['status'] ?? null, fn ($query, $status) => $query->where('b.status', $status))
            ->when($filters['connection'] ?? null, fn ($query, $connection) => $query->where('c.code', $connection))
            ->select(['b.*', 'c.code as connection_code', 'c.name as connection_name', 'c.ota', 'p.code as product_code', 'p.name as product_name', 'r.code as reservation_code']);
        $counts = DB::table('channel_ota_bookings')->groupBy('status')->selectRaw('status, count(*) as total')->pluck('total', 'status')->map(fn ($total): int => (int) $total)->all();

        return CursorPage::respond($request, $query, ['received_at' => 'b.received_at', 'travel_date' => 'b.travel_date'], '-received_at', fn (object $row): array => [
            'id' => (string) $row->id,
            'ota_booking_ref' => $row->ota_booking_ref,
            'connection' => ['code' => $row->connection_code, 'name' => $row->connection_name, 'ota' => $row->ota, 'ota_label' => self::OTAS[$row->ota] ?? $row->ota],
            'product' => $row->product_code === null ? null : ['code' => $row->product_code, 'name' => $row->product_name],
            'reservation' => $row->reservation_code,
            'travel_date' => $row->travel_date,
            'pax' => $row->pax === null ? null : (int) $row->pax,
            'gross_amount' => Decimal::toApi($row->gross_amount),
            'net_amount' => Decimal::toApi($row->net_amount),
            'currency' => $row->currency,
            'status' => $row->status,
            'status_label' => self::BOOKING_STATUSES[$row->status] ?? $row->status,
            'error' => $row->error,
            'received_at' => $row->received_at,
        ], ['counts' => $counts, 'statuses' => self::BOOKING_STATUSES]);
    }

    private function listings(string $connectionId, float $markup): array
    {
        return DB::table('channel_ota_product_mappings as m')->join('catalog_products as p', 'p.id', '=', 'm.product_id')
            ->where('m.connection_id', $connectionId)->whereIn('m.status', ['pendiente', 'activo', 'error'])
            ->get(['p.code', 'm.ota_product_ref', 'm.ota_option_ref', 'm.price_mode', 'm.fixed_price'])
            ->map(fn (object $row): array => ['product' => $row->code, 'ota_product_ref' => $row->ota_product_ref, 'ota_option_ref' => $row->ota_option_ref, 'price_mode' => $row->price_mode, 'fixed_price' => $row->fixed_price, 'markup_pct' => $markup])
            ->all();
    }

    private function row(string $code, bool $lock = false): object
    {
        $query = DB::table('channel_ota_connections')->where('code', $code);

        return ($lock ? $query->lock('for no key update') : $query)->first() ?? throw ApiException::notFound('La conexión con la OTA no existe.');
    }

    private function find(string $code): array
    {
        return $this->present($this->row($code));
    }

    private function mapping(object $row): array
    {
        return [
            'product' => ['code' => $row->product_code, 'name' => $row->product_name],
            'ota_product_ref' => $row->ota_product_ref,
            'ota_option_ref' => $row->ota_option_ref,
            'price_mode' => $row->price_mode,
            'price_mode_label' => self::PRICE_MODES[$row->price_mode] ?? $row->price_mode,
            'fixed_price' => Decimal::toApi($row->fixed_price),
            'status' => $row->status,
            'status_label' => self::MAPPING_STATUSES[$row->status] ?? $row->status,
            'last_sync_at' => $row->last_sync_at,
            'last_error' => $row->last_error,
        ];
    }

    private function present(object $row): array
    {
        return [
            'code' => $row->code,
            'ota' => $row->ota,
            'ota_label' => self::OTAS[$row->ota] ?? $row->ota,
            'name' => $row->name,
            'account_ref' => $row->account_ref,
            'has_credentials' => $row->credentials_encrypted !== null,
            'commission_pct' => (string) $row->commission_pct,
            'markup_pct' => (string) $row->markup_pct,
            'sync_availability' => (bool) $row->sync_availability,
            'status' => $row->status,
            'status_label' => self::STATUSES[$row->status] ?? $row->status,
            'last_sync_at' => $row->last_sync_at,
            'last_error' => $row->last_error,
            'lock_version' => (int) $row->lock_version,
        ];
    }
}
