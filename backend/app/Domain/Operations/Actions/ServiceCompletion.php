<?php

declare(strict_types=1);

namespace App\Domain\Operations\Actions;

use App\Domain\Iam\Models\User;
use App\Domain\Operations\Support\OpsCommon;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ServiceCompletion
{
    public const COMPLETABLE = ['confirmado', 'en_curso'];

    public function __construct(private readonly OpsCommon $common, private readonly AuditLogger $audit) {}

    public function complete(string $reference, ?string $note, User $actor): array
    {
        return DB::transaction(function () use ($reference, $note, $actor): array {
            $service = DB::table('booking_reservation_services')->where(Str::isUuid($reference) ? 'id' : 'code', $reference)->lock('for no key update')
                ->first(['id', 'code', 'name', 'status', 'service_date', 'reservation_id', 'lock_version']) ?? throw ApiException::notFound('El servicio no existe.');
            $order = DB::table('ops_orders')->whereNull('deleted_at')->where('reservation_id', $service->reservation_id)->where('status', '<>', 'cancelada')->first(['id', 'code', 'status'])
                ?? throw ApiException::conflict('OPS-BR-05', 'Este servicio no tiene una orden operativa activa.');

            if ($order->status === 'completada') {
                throw ApiException::conflict('OPS-BR-05', 'La orden ya está cerrada.');
            }

            if ($service->status === 'completado') {
                throw ApiException::conflict('OPS-BR-05', 'El servicio ya figura como completado.');
            }

            if (! in_array($service->status, self::COMPLETABLE, true)) {
                throw ApiException::conflict('OPS-BR-05', 'Solo se completa un servicio confirmado por el proveedor o en curso.');
            }

            if ((string) $service->service_date > $this->common->today()) {
                throw ApiException::unprocessable('OPS-BR-13', 'El servicio no puede completarse antes de su fecha ('.CarbonImmutable::parse($service->service_date)->format('d/m/Y').').');
            }

            $assignment = DB::table('ops_assignments')->where('order_id', $order->id)->where('reservation_service_id', $service->id)->first(['id', 'status']);

            if ($assignment !== null && in_array($assignment->status, ['pendiente', 'asignada'], true)) {
                throw ApiException::conflict('OPS-BR-05', 'Confirma los recursos asignados a este servicio antes de completarlo.');
            }

            DB::table('booking_reservation_services')->where('id', $service->id)->update(['status' => 'completado', 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);

            if ($assignment !== null && $assignment->status !== 'completada') {
                DB::table('ops_assignments')->where('id', $assignment->id)->update(['status' => 'completada', 'finished_at' => DB::raw('coalesce(finished_at, now())'), 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            }

            $this->audit->log('Servicio', $service->code, 'completar', $service->status, 'completado', evidence: ['orden' => $order->code, 'servicio' => $service->name, 'observacion' => $note], actor: $actor);

            return ['code' => $service->code, 'status' => 'completado', 'lock_version' => (int) $service->lock_version + 1, 'order_code' => $order->code];
        });
    }
}
