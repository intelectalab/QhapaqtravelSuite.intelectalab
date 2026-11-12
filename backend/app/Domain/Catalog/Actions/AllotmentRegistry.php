<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Actions;

use App\Domain\Admin\Actions\ManageIntegrations;
use App\Domain\Catalog\Support\AllotmentConsumption;
use App\Domain\Catalog\Support\AllotmentDirectory;
use App\Domain\Catalog\Support\AllotmentNotices;
use App\Domain\Catalog\Support\CatalogAccess;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class AllotmentRegistry
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly CodeSequence $codes,
        private readonly AllotmentConsumption $consumption,
        private readonly ManageIntegrations $jobs,
    ) {}

    public function create(array $data, User $actor): string
    {
        return DB::transaction(function () use ($data, $actor): string {
            $service = DB::table('catalog_services')->where('id', $data['service_id'])->whereNull('deleted_at')->first(['id', 'provider_id', 'type', 'name'])
                ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige el servicio contratado.');

            if ((string) $service->provider_id !== (string) $data['provider_id']) {
                throw ApiException::unprocessable('CUP-BR-002', 'El servicio no pertenece al proveedor elegido.');
            }

            $kind = AllotmentDirectory::SERVICE_KINDS[$service->type] ?? throw ApiException::unprocessable('CUP-BR-002', 'Solo se contratan cupos de alojamiento, tren o entradas.');
            $provider = DB::table('catalog_providers')->where('id', $data['provider_id'])->whereNull('deleted_at')->first(['id', 'status', 'name']) ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige el proveedor.');

            if ($provider->status !== 'activo') {
                throw ApiException::unprocessable('PRD-BR-007', 'El proveedor no está activo: no se le pueden contratar cupos.');
            }

            $values = $this->values($data);
            $this->assertNoOverlap((string) $service->id, $values['valid_from'], $values['valid_to'], null);
            $code = $this->codes->next('catalog_allotments', 'CUP-'.Carbon::parse(CatalogAccess::today())->year.'-', 3);
            $id = (string) DB::table('catalog_allotments')->insertGetId([
                ...$values,
                'code' => $code,
                'provider_id' => $provider->id,
                'service_id' => $service->id,
                'kind' => $kind,
                'status' => 'activo',
                'owner_id' => $actor->getKey(),
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ], 'id');
            $contract = $this->lock($id);
            $this->generateDays($contract, null);
            $this->consumption->sync($contract);
            $this->settle($contract);
            $this->event($contract, 'Contrato registrado'.($values['contract_ref'] ? " ({$values['contract_ref']})" : ''), $actor);
            $this->audit->log('Cupo', $code, 'crear', after: "{$values['base_qty']} ".AllotmentDirectory::UNITS[$kind]." · {$values['valid_from']} a {$values['valid_to']} · {$values['currency']} {$values['net_rate']}");

            return $code;
        });
    }

    public function update(string $code, array $data, ?int $version, User $actor): string
    {
        return DB::transaction(function () use ($code, $data, $version, $actor): string {
            $contract = $this->lock($code);
            $this->assertVersion($contract, $version);

            if ($contract->status === 'liberado') {
                throw ApiException::conflict('CUP-BR-011', 'El contrato está liberado: ya no se edita.');
            }

            $values = $this->values($data);
            $this->assertNoOverlap((string) $contract->service_id, $values['valid_from'], $values['valid_to'], (string) $contract->id);
            $before = "{$contract->base_qty} · rel {$contract->release_days} · {$contract->net_rate} · {$contract->penalty_pct} % · {$contract->valid_from} a {$contract->valid_to}";
            $status = $contract->status === 'vencido' && $values['valid_to'] >= CatalogAccess::today() ? 'activo' : $contract->status;
            DB::table('catalog_allotments')->where('id', $contract->id)->update([...$values, 'status' => $status, 'lock_version' => $contract->lock_version + 1, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $updated = $this->lock($contract->id);
            $this->generateDays($updated, $contract);
            $this->consumption->sync($updated);
            $this->settle($updated);
            $this->event($updated, 'Condiciones del contrato editadas', $actor);
            $this->audit->log('Cupo', $code, 'editar_contrato', $before, "{$values['base_qty']} · rel {$values['release_days']} · {$values['net_rate']} · {$values['penalty_pct']} % · {$values['valid_from']} a {$values['valid_to']}");

            return $code;
        });
    }

    public function delete(string $code, string $reason, User $actor): void
    {
        DB::transaction(function () use ($code, $reason, $actor): void {
            $contract = $this->lock($code);
            $days = DB::table('catalog_allotment_days')->where('allotment_id', $contract->id)->pluck('id');

            if (DB::table('catalog_allotment_consumptions')->whereIn('allotment_day_id', $days)->where('state', '<>', 'revertido')->exists() || DB::table('catalog_allotment_charges')->whereIn('allotment_day_id', $days)->exists()) {
                throw ApiException::conflict('CUP-BR-012', 'El contrato tiene reservas o penalidades registradas: no se elimina. Libéralo para cerrarlo.');
            }

            DB::table('catalog_allotments')->where('id', $contract->id)->update(['deleted_at' => now(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Cupo', $code, 'eliminar', $contract->status, $reason);
        });
    }

    public function releaseContract(string $code, string $reason, ?int $version, User $actor): int
    {
        return DB::transaction(function () use ($code, $reason, $version, $actor): int {
            $contract = $this->lock($code);
            $this->assertVersion($contract, $version);
            $this->assertOpen($contract);
            $this->consumption->sync($contract);
            $today = CatalogAccess::today();
            $days = DB::table('catalog_allotment_days')->where('allotment_id', $contract->id)->where('service_date', '>=', $today)->whereNull('closed_at')->lockForUpdate()->get();
            $units = 0;

            foreach ($days as $day) {
                $free = max(0, (int) $day->blocked_qty - (int) $day->released_qty - (int) $day->used_qty - (int) $day->pending_qty);
                $units += $free;
                DB::table('catalog_allotment_days')->where('id', $day->id)->update(['released_qty' => (int) $day->released_qty + $free, 'retained_at' => null, 'retained_reason' => null, 'retained_by' => null, 'lock_version' => $day->lock_version + 1, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            }

            DB::table('catalog_allotments')->where('id', $contract->id)->update(['status' => 'liberado', 'released_at' => now(), 'release_reason' => $reason, 'lock_version' => $contract->lock_version + 1, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->event($contract, "Contrato liberado ({$units} unidades): {$reason}", $actor);
            $this->audit->log('Cupo', $code, 'liberar_contrato', $contract->status, "liberado · {$units} unidades · {$reason}");
            app(AllotmentNotices::class)->toProvider((string) $contract->id, 'cupo.liberacion', 'Liberamos el contrato de cupo', "Liberamos todas las fechas futuras del contrato ({$units} unidades sin usar).\nMotivo: {$reason}");

            return $units;
        });
    }

    public function releaseDay(string $code, string $date, int $qty, ?int $version, User $actor): void
    {
        DB::transaction(function () use ($code, $date, $qty, $version, $actor): void {
            $contract = $this->lock($code);
            $this->assertOpen($contract);
            $this->consumption->sync($contract);
            $day = $this->day($contract, $date, $version);
            $free = max(0, (int) $day->blocked_qty - (int) $day->released_qty - (int) $day->used_qty - (int) $day->pending_qty);

            if ($qty < 1 || $qty > $free) {
                throw ApiException::unprocessable('CUP-BR-005', $free === 0 ? 'No quedan unidades disponibles para liberar en esa fecha.' : "Solo puedes liberar entre 1 y {$free} unidades: lo consumido por reservas no se libera.");
            }

            $clear = $qty === $free;
            DB::table('catalog_allotment_days')->where('id', $day->id)->update([
                'released_qty' => (int) $day->released_qty + $qty,
                'retained_at' => $clear ? null : $day->retained_at,
                'retained_reason' => $clear ? null : $day->retained_reason,
                'retained_by' => $clear ? null : $day->retained_by,
                'lock_version' => $day->lock_version + 1,
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);
            $this->settle($contract);
            $this->event($contract, "Liberación manual de {$qty} unidades del {$date}", $actor);
            $this->audit->log('Cupo', $code, 'liberar', "{$date} · cupo ".((int) $day->blocked_qty - (int) $day->released_qty), 'cupo '.((int) $day->blocked_qty - (int) $day->released_qty - $qty));
            app(AllotmentNotices::class)->toProvider((string) $contract->id, 'cupo.release', 'Liberamos unidades de cupo', "Liberamos {$qty} unidad(es) del {$date}. Quedan disponibles para tu venta.");
        });
    }

    public function retain(string $code, string $date, string $reason, ?int $version, User $actor): void
    {
        DB::transaction(function () use ($code, $date, $reason, $version, $actor): void {
            $contract = $this->lock($code);
            $this->assertOpen($contract);
            $day = $this->day($contract, $date, $version);
            $free = max(0, (int) $day->blocked_qty - (int) $day->released_qty - (int) $day->used_qty - (int) $day->pending_qty);
            DB::table('catalog_allotment_days')->where('id', $day->id)->update(['retained_at' => now(), 'retained_reason' => $reason, 'retained_by' => $actor->getKey(), 'lock_version' => $day->lock_version + 1, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->settle($contract);
            $exposure = number_format(AllotmentDirectory::penalty($contract, $free), 2, '.', '');
            $this->event($contract, "Retención del {$date}: {$reason}", $actor);
            $this->audit->log('Cupo', $code, 'retener', $date, "{$reason} · exposición {$contract->currency} {$exposure}");
        });
    }

    public function unretain(string $code, string $date, ?int $version, User $actor): void
    {
        DB::transaction(function () use ($code, $date, $version, $actor): void {
            $contract = $this->lock($code);
            $this->assertOpen($contract);
            $day = $this->day($contract, $date, $version);

            if ($day->retained_at === null) {
                throw ApiException::conflict('CUP-BR-007', 'Esa fecha no está retenida.');
            }

            DB::table('catalog_allotment_days')->where('id', $day->id)->update(['retained_at' => null, 'retained_reason' => null, 'retained_by' => null, 'lock_version' => $day->lock_version + 1, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->settle($contract);
            $this->event($contract, "Retención retirada del {$date}", $actor);
            $this->audit->log('Cupo', $code, 'quitar_retencion', $date, (string) $day->retained_reason);
        });
    }

    public function requestExpansion(string $code, array $data, User $actor): string
    {
        return DB::transaction(function () use ($code, $data, $actor): string {
            $contract = $this->lock($code);
            $this->assertOpen($contract);

            if ($data['date_from'] < CatalogAccess::today() || $data['date_from'] < $contract->valid_from || $data['date_to'] > $contract->valid_to) {
                throw ApiException::unprocessable('CUP-BR-004', 'La ampliación debe ser futura y estar dentro de la vigencia del contrato ('.$contract->valid_from.' a '.$contract->valid_to.').');
            }

            $request = $this->codes->next('catalog_allotment_requests', 'AMP-', 4);
            DB::table('catalog_allotment_requests')->insert([
                'code' => $request,
                'allotment_id' => $contract->id,
                'date_from' => $data['date_from'],
                'date_to' => $data['date_to'],
                'extra_qty' => (int) $data['extra_qty'],
                'note' => trim($data['note']),
                'status' => 'solicitada',
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ]);
            $this->event($contract, "Ampliación {$request} solicitada: +{$data['extra_qty']} del {$data['date_from']} al {$data['date_to']}", $actor);
            $this->audit->log('Cupo', $code, 'solicitar_ampliacion', after: "{$request} · +{$data['extra_qty']} · {$data['date_from']} a {$data['date_to']}");
            app(AllotmentNotices::class)->toProvider((string) $contract->id, 'cupo.ampliacion', "Solicitud de ampliación {$request}", "Te pedimos ampliar el cupo en {$data['extra_qty']} unidad(es) del {$data['date_from']} al {$data['date_to']}.\nNota: ".trim($data['note'])."\n\nResponde la solicitud desde la extranet de proveedores.");

            return $request;
        });
    }

    public function respondExpansion(string $code, string $request, bool $accepted, string $response, User $actor): void
    {
        DB::transaction(function () use ($code, $request, $accepted, $response, $actor): void {
            $contract = $this->lock($code);
            $row = DB::table('catalog_allotment_requests')->where('allotment_id', $contract->id)->where('code', $request)->lockForUpdate()->first() ?? throw ApiException::notFound('La solicitud de ampliación no existe.');

            if ($row->status !== 'solicitada') {
                throw ApiException::conflict('CUP-BR-004', 'La solicitud ya tiene respuesta.');
            }

            if ($accepted) {
                $this->assertOpen($contract);
                DB::table('catalog_allotment_days')->where('allotment_id', $contract->id)->whereBetween('service_date', [$row->date_from, $row->date_to])->whereNull('closed_at')
                    ->update(['blocked_qty' => DB::raw('blocked_qty + '.(int) $row->extra_qty), 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            }

            $status = $accepted ? 'aceptada' : 'rechazada';
            DB::table('catalog_allotment_requests')->where('id', $row->id)->update(['status' => $status, 'response' => $response, 'responded_at' => now(), 'responded_by' => $actor->getKey(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->settle($contract);
            $this->event($contract, "Ampliación {$request} {$status}: {$response}", $actor);
            $this->audit->log('Cupo', $code, "ampliacion_{$status}", 'solicitada', $request.($accepted ? " · +{$row->extra_qty}" : ''));
        });
    }

    public function runReleaseJob(User $actor): array
    {
        return $this->jobs->run('JOB-10', $actor);
    }

    private function values(array $data): array
    {
        if (Carbon::parse($data['valid_from'])->diffInDays(Carbon::parse($data['valid_to'])) > 730) {
            throw ApiException::unprocessable('CUP-BR-001', 'Un contrato de cupo cubre como máximo dos años.');
        }

        return [
            'name' => trim($data['name']),
            'contract_ref' => ($data['contract_ref'] ?? null) !== null ? trim($data['contract_ref']) : null,
            'valid_from' => $data['valid_from'],
            'valid_to' => $data['valid_to'],
            'base_qty' => (int) $data['base_qty'],
            'release_days' => (int) $data['release_days'],
            'net_rate' => number_format((float) $data['net_rate'], 2, '.', ''),
            'currency' => $data['currency'],
            'penalty_pct' => number_format((float) $data['penalty_pct'], 2, '.', ''),
            'notes' => $data['notes'] ?? null,
        ];
    }

    private function generateDays(object $contract, ?object $previous): void
    {
        $existing = DB::table('catalog_allotment_days')->where('allotment_id', $contract->id)->get()->keyBy('service_date');
        $outside = $existing->filter(fn (object $day) => $day->service_date < $contract->valid_from || $day->service_date > $contract->valid_to);

        if ($outside->isNotEmpty()) {
            $ids = $outside->pluck('id');

            if ($outside->contains(fn (object $day) => $day->closed_at !== null) || DB::table('catalog_allotment_consumptions')->whereIn('allotment_day_id', $ids)->where('state', '<>', 'revertido')->exists()) {
                throw ApiException::unprocessable('CUP-BR-001', 'La nueva vigencia deja fuera fechas con reservas o ya cerradas. Ajusta las fechas.');
            }

            DB::table('catalog_allotment_consumptions')->whereIn('allotment_day_id', $ids)->delete();
            DB::table('catalog_allotment_days')->whereIn('id', $ids)->delete();
        }

        $delta = $previous !== null ? (int) $contract->base_qty - (int) $previous->base_qty : 0;
        $rows = [];
        $date = Carbon::parse($contract->valid_from);
        $end = Carbon::parse($contract->valid_to);

        while ($date->lte($end)) {
            $iso = $date->toDateString();
            $deadline = $date->copy()->subDays((int) $contract->release_days)->toDateString();
            $day = $existing->get($iso);

            if ($day === null) {
                $rows[] = ['allotment_id' => $contract->id, 'service_date' => $iso, 'blocked_qty' => (int) $contract->base_qty, 'release_deadline' => $deadline];
            } elseif ($day->closed_at === null) {
                $blocked = max(0, (int) $day->blocked_qty + $delta);
                DB::table('catalog_allotment_days')->where('id', $day->id)->update(['blocked_qty' => $blocked, 'released_qty' => min((int) $day->released_qty, $blocked), 'release_deadline' => $deadline, 'updated_at' => now()]);
            }

            $date->addDay();
        }

        foreach (array_chunk($rows, 200) as $chunk) {
            DB::table('catalog_allotment_days')->insert($chunk);
        }
    }

    private function assertNoOverlap(string $service, string $from, string $to, ?string $except): void
    {
        $overlap = DB::table('catalog_allotments')->where('service_id', $service)->whereIn('status', ['activo', 'en_release'])->whereNull('deleted_at')
            ->when($except !== null, fn ($query) => $query->where('id', '<>', $except))
            ->where('valid_from', '<=', $to)->where('valid_to', '>=', $from)->lockForUpdate()->value('code');

        if ($overlap !== null) {
            throw ApiException::conflict('CUP-BR-003', "Ya existe el contrato {$overlap} vigente para ese servicio en esas fechas.");
        }
    }

    private function assertVersion(object $contract, ?int $version): void
    {
        if ($version !== null && $version !== (int) $contract->lock_version) {
            throw ApiException::conflict('STALE_VERSION', 'Otra persona cambió el contrato. Recarga la página y vuelve a intentarlo.');
        }
    }

    private function assertOpen(object $contract): void
    {
        if (AllotmentDirectory::closed($contract)) {
            throw ApiException::conflict('CUP-BR-011', $contract->status === 'liberado' ? 'El contrato ya está liberado.' : 'El contrato está vencido.');
        }
    }

    private function day(object $contract, string $date, ?int $version): object
    {
        $day = DB::table('catalog_allotment_days')->where('allotment_id', $contract->id)->where('service_date', $date)->lockForUpdate()->first() ?? throw ApiException::notFound('El contrato no cubre esa fecha.');

        if ($version !== null && $version !== (int) $day->lock_version) {
            throw ApiException::conflict('STALE_VERSION', 'Otra persona cambió esta fecha. Recarga la página y vuelve a intentarlo.');
        }

        if ($date < CatalogAccess::today() || $day->closed_at !== null) {
            throw ApiException::unprocessable('CUP-BR-005', 'Las fechas pasadas ya no se liberan ni se retienen.');
        }

        return $day;
    }

    private function settle(object $contract): void
    {
        $fresh = $this->lock($contract->id);
        $status = $this->consumption->status($fresh, CatalogAccess::today());

        if ($status !== $fresh->status) {
            DB::table('catalog_allotments')->where('id', $fresh->id)->update(['status' => $status, 'updated_at' => now()]);
            $this->audit->log('Cupo', (string) $fresh->code, 'cambiar_estado', (string) $fresh->status, $status);
        }
    }

    private function lock(string $code): object
    {
        return DB::table('catalog_allotments')->whereNull('deleted_at')->where(Str::isUuid($code) ? 'id' : 'code', $code)->lockForUpdate()->first() ?? throw ApiException::notFound('El contrato de cupo no existe.');
    }

    private function event(object $contract, string $message, User $actor): void
    {
        DB::table('catalog_allotment_events')->insert(['allotment_id' => $contract->id, 'user_id' => $actor->getKey(), 'message' => mb_substr($message, 0, 300)]);
    }
}
