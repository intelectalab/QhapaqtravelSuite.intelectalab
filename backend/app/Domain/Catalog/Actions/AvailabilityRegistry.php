<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Actions;

use App\Domain\Catalog\Support\CatalogAccess;
use App\Domain\Catalog\Support\DepartureDirectory;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\QueryException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class AvailabilityRegistry
{
    public function __construct(private readonly AuditLogger $audit, private readonly CodeSequence $codes) {}

    public function createRange(array $data, User $actor): string
    {
        return $this->guarded(function () use ($data, $actor): string {
            $product = DB::table('catalog_products')->where('id', $data['product_id'])->whereNull('deleted_at')->first(['id', 'code'])
                ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige un producto del catálogo.');
            $values = $this->rangeValues($data);
            $code = $this->codes->next('catalog_availability_ranges', 'RG-', 4);
            DB::table('catalog_availability_ranges')->insert([...$values, 'code' => $code, 'product_id' => $product->id, 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
            $this->audit->log('Disponibilidad', $code, 'crear', after: "{$product->code} · {$values['date_from']} a {$values['date_to']} · {$values['status']} · {$values['capacity_per_day']} por día");

            return $code;
        });
    }

    public function updateRange(string $code, array $data, User $actor): string
    {
        return $this->guarded(function () use ($code, $data, $actor): string {
            $range = DB::table('catalog_availability_ranges')->where('code', $code)->whereNull('deleted_at')->lockForUpdate()->first() ?? throw ApiException::notFound('El rango no existe.');
            $values = $this->rangeValues($data);
            DB::table('catalog_availability_ranges')->where('id', $range->id)->update([...$values, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Disponibilidad', $code, 'modificar', "{$range->date_from} a {$range->date_to} · {$range->status} · {$range->capacity_per_day}", "{$values['date_from']} a {$values['date_to']} · {$values['status']} · {$values['capacity_per_day']}");

            return $code;
        });
    }

    public function deleteRange(string $code, string $reason, User $actor): void
    {
        $range = DB::table('catalog_availability_ranges')->where('code', $code)->whereNull('deleted_at')->first() ?? throw ApiException::notFound('El rango no existe.');
        DB::table('catalog_availability_ranges')->where('id', $range->id)->update(['deleted_at' => now(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Disponibilidad', $code, 'eliminar', "{$range->date_from} a {$range->date_to} · {$range->status}", $reason);
    }

    public function createHold(array $data, User $actor): string
    {
        return DB::transaction(function () use ($data, $actor): string {
            $departure = DB::table('catalog_product_departures as d')->join('catalog_products as p', 'p.id', '=', 'd.product_id')
                ->where('d.id', $data['departure_id'])->lockForUpdate()
                ->first(['d.*', 'p.status as product_status', 'p.code as product_code']) ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige una salida.');

            if ($departure->product_status !== 'ACTIVE') {
                throw ApiException::unprocessable('PRD-BR-002', 'El producto no está activo: no admite bloqueos.');
            }

            if ($departure->status !== 'abierta' || $departure->departure_date < CatalogAccess::today()) {
                throw ApiException::unprocessable('CAT-BR-21', 'Solo se bloquean cupos de salidas abiertas y futuras.');
            }

            $available = DepartureDirectory::available($departure, DepartureDirectory::held($departure->id));
            $quantity = (int) $data['quantity'];

            if ($quantity > $available) {
                throw ApiException::unprocessable('PRD-BR-012', "Cupo insuficiente: quedan {$available} libres en {$departure->ref}.".$this->alternatives($departure, $quantity));
            }

            $ref = $this->codes->next('catalog_availability_holds', 'HLD-', 4, 'ref');
            $minutes = max(5, (int) ($data['minutes'] ?? 30));
            DB::table('catalog_availability_holds')->insert([
                'ref' => $ref,
                'departure_id' => $departure->id,
                'quantity' => $quantity,
                'reference' => trim($data['reference']),
                'status' => 'hold',
                'expires_at' => now()->addMinutes($minutes),
                'notes' => $data['notes'] ?? null,
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ]);
            $this->audit->log('Hold', $ref, 'crear', after: "{$departure->ref} · {$quantity} cupos · {$data['reference']} · {$minutes} min");

            return $ref;
        });
    }

    public function sellSeats(string $departureRef, array $data, User $actor): array
    {
        return DB::transaction(function () use ($departureRef, $data, $actor): array {
            $departure = DB::table('catalog_product_departures as d')->join('catalog_products as p', 'p.id', '=', 'd.product_id')
                ->where('d.ref', $departureRef)->lockForUpdate()
                ->first(['d.*', 'p.status as product_status']) ?? throw ApiException::notFound('La salida no existe.');

            if ((int) $departure->lock_version !== (int) $data['lock_version']) {
                throw ApiException::conflict('STALE_VERSION', 'Alguien cambió esta salida mientras la veías. Recarga la página e inténtalo de nuevo.');
            }

            if ($departure->product_status !== 'ACTIVE') {
                throw ApiException::unprocessable('PRD-BR-002', 'El producto no está activo: no admite ventas.');
            }

            if ($departure->status !== 'abierta' || $departure->departure_date < CatalogAccess::today()) {
                throw ApiException::unprocessable('CAT-BR-21', 'Solo se venden cupos de salidas abiertas y futuras.');
            }

            $available = DepartureDirectory::available($departure, DepartureDirectory::held($departure->id));
            $quantity = (int) $data['quantity'];

            if ($quantity > $available) {
                throw ApiException::unprocessable('PRD-BR-012', "Cupo insuficiente: quedan {$available} libres en {$departure->ref}.".$this->alternatives($departure, $quantity));
            }

            $ref = $this->codes->next('catalog_availability_holds', 'HLD-', 4, 'ref');
            DB::table('catalog_availability_holds')->insert([
                'ref' => $ref,
                'departure_id' => $departure->id,
                'product_id' => $departure->product_id,
                'service_date' => $departure->departure_date,
                'quantity' => $quantity,
                'reference' => trim($data['reference']),
                'status' => 'confirmada',
                'expires_at' => now(),
                'notes' => 'Venta directa',
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ]);
            $this->moveSold($departure, $quantity, $actor);
            $this->audit->log('Salida', $departure->ref, 'confirmar_cupos', "{$departure->sold} vendidos", ($departure->sold + $quantity)." vendidos · {$quantity} cupos · {$data['reference']} · {$ref}");

            return ['ref' => $departure->ref, 'hold' => $ref, 'sold' => (int) $departure->sold + $quantity, 'lock_version' => (int) $departure->lock_version + 1];
        });
    }

    public function confirmHold(string $ref, User $actor): void
    {
        DB::transaction(function () use ($ref, $actor): void {
            $hold = $this->hold($ref);

            if ($hold->status !== 'hold') {
                throw ApiException::conflict('CAT-BR-22', 'Solo se confirman bloqueos en estado hold.');
            }

            if ($hold->expires_at < now()) {
                throw ApiException::conflict('CAT-BR-22', "El hold {$ref} expiró. Crea uno nuevo si aún hay cupo.");
            }

            $departure = $this->departureFor($hold);

            if (DB::table('catalog_products')->where('id', $departure->product_id)->value('status') !== 'ACTIVE') {
                throw ApiException::unprocessable('PRD-BR-002', 'El producto no está activo: no se pueden confirmar sus cupos.');
            }

            if ($departure->sold + $hold->quantity > $departure->capacity) {
                throw ApiException::conflict('PRD-BR-012', 'Confirmar este hold excede la capacidad de la salida.');
            }

            $this->moveSold($departure, $hold->quantity, $actor);
            $this->setHold($hold, 'confirmada', null, $actor);
        });
    }

    public function releaseHold(string $ref, string $reason, User $actor): void
    {
        DB::transaction(function () use ($ref, $reason, $actor): void {
            $hold = $this->hold($ref);

            if (! in_array($hold->status, ['hold', 'confirmada'], true)) {
                throw ApiException::conflict('CAT-BR-24', 'Este bloqueo ya está cerrado.');
            }

            if ($hold->status === 'confirmada') {
                $this->moveSold($this->departureFor($hold), -$hold->quantity, $actor);
            }

            $this->setHold($hold, 'liberada', $reason, $actor);
        });
    }

    public function consumeHold(string $ref, User $actor): void
    {
        DB::transaction(function () use ($ref, $actor): void {
            $hold = $this->hold($ref);

            if ($hold->status !== 'confirmada') {
                throw ApiException::conflict('CAT-BR-24', 'Solo se marcan como usados los cupos confirmados.');
            }

            $this->setHold($hold, 'consumida', null, $actor);
        });
    }

    public function expireHolds(User $actor): int
    {
        return DB::transaction(function () use ($actor): int {
            $refs = DB::table('catalog_availability_holds')->where('status', 'hold')->where('expires_at', '<', now())->lockForUpdate()->pluck('ref');
            DB::table('catalog_availability_holds')->whereIn('ref', $refs)->update(['status' => 'expirada', 'updated_by' => $actor->getKey(), 'updated_at' => now()]);

            foreach ($refs as $ref) {
                $this->audit->log('Hold', (string) $ref, 'expirar', 'hold', 'expirada');
            }

            return $refs->count();
        });
    }

    private function hold(string $ref): object
    {
        return DB::table('catalog_availability_holds')->where('ref', $ref)->lockForUpdate()->first() ?? throw ApiException::notFound('El bloqueo no existe.');
    }

    private function departureFor(object $hold): object
    {
        return DB::table('catalog_product_departures')->where('id', $hold->departure_id)->lock('for no key update')->first() ?? throw ApiException::conflict('CAT-BR-22', 'El bloqueo no está asociado a una salida.');
    }

    private function moveSold(object $departure, int $delta, User $actor): void
    {
        $sold = max(0, (int) $departure->sold + $delta);
        $status = match (true) {
            $departure->status === 'abierta' && $sold >= $departure->capacity => 'completa',
            $departure->status === 'completa' && $sold < $departure->capacity => 'abierta',
            default => $departure->status,
        };
        DB::table('catalog_product_departures')->where('id', $departure->id)->update(['sold' => $sold, 'status' => $status, 'lock_version' => $departure->lock_version + 1, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
    }

    private function setHold(object $hold, string $status, ?string $reason, User $actor): void
    {
        DB::table('catalog_availability_holds')->where('id', $hold->id)->update(['status' => $status, 'released_reason' => $reason ?? $hold->released_reason, 'lock_version' => $hold->lock_version + 1, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Hold', $hold->ref, match ($status) {
            'confirmada' => 'confirmar',
            'liberada' => 'liberar',
            default => 'consumir',
        }, $hold->status, trim($status.($reason ? " · {$reason}" : '')));
    }

    private function alternatives(object $departure, int $quantity): string
    {
        $held = DB::table('catalog_availability_holds')->where('status', 'hold')->selectRaw('departure_id, sum(quantity) as total')->groupBy('departure_id')->pluck('total', 'departure_id');
        $options = DB::table('catalog_product_departures')->where('product_id', $departure->product_id)->where('id', '<>', $departure->id)
            ->where('status', 'abierta')->where('departure_date', '>=', CatalogAccess::today())->orderBy('departure_date')->limit(30)->get()
            ->filter(fn (object $other) => DepartureDirectory::available($other, (int) ($held[$other->id] ?? 0)) >= $quantity)
            ->take(3)
            ->map(fn (object $other) => "{$other->ref} ({$other->departure_date})");

        return $options->isEmpty() ? '' : ' Alternativas: '.$options->implode(', ').'.';
    }

    private function rangeValues(array $data): array
    {
        $open = $data['status'] === 'disponible';

        if (Carbon::parse($data['date_from'])->diffInDays(Carbon::parse($data['date_to'])) > 730) {
            throw ApiException::unprocessable('CAT-BR-19', 'Un rango cubre como máximo dos años.');
        }

        return [
            'date_from' => $data['date_from'],
            'date_to' => $data['date_to'],
            'status' => $data['status'],
            'capacity_per_day' => $open ? (int) $data['capacity_per_day'] : 0,
            'note' => $data['note'] ?? null,
        ];
    }

    private function guarded(callable $work): string
    {
        try {
            return DB::transaction($work);
        } catch (QueryException $exception) {
            if ($exception->getCode() === '23P01') {
                throw ApiException::unprocessable('CAT-BR-19', 'Ese rango se cruza con otro del mismo producto y tipo. Ajusta las fechas o edita el existente.');
            }

            throw $exception;
        }
    }
}
