<?php

declare(strict_types=1);

namespace App\Domain\SupplierPortal\Actions;

use App\Domain\Operations\Support\OpsNotices;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Concurrency\IfMatch;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\SupplierPortal\Support\SupplierAccount;
use Illuminate\Support\Facades\DB;

final class SupplierRooming
{
    public function __construct(private readonly AuditLogger $audit, private readonly OpsNotices $notices, private readonly SupplierIncidents $incidents) {}

    public function acknowledge(SupplierAccount $account, string $id, ?int $version): void
    {
        DB::transaction(function () use ($account, $id, $version): void {
            $list = $this->current($account, $id, $version);

            if ($list->hotel_ack_at !== null) {
                throw ApiException::conflict('SUP-BR-20', 'Ya acusó recibo de esta rooming list.');
            }

            DB::table('ops_rooming_lists')->where('id', $list->id)->update(['hotel_ack_at' => now(), 'hotel_ack_by' => $account->user->getKey(), 'updated_by' => $account->user->getKey()]);
            $this->audit->log('Rooming list', $list->reservation_code, 'acuse_recibo_hotel', null, $account->provider->name);
            $this->notices->toOperations('rooming.recibida', "{$account->provider->name} acusó recibo de la rooming list {$list->reservation_code}", null, 'ops_rooming_list', $list->id, $list->reservation_id, $this->coordinator($list->reservation_id));
        });
    }

    public function confirm(SupplierAccount $account, string $id, ?int $version): int
    {
        return DB::transaction(function () use ($account, $id, $version): int {
            $list = $this->current($account, $id, $version);

            if ($list->hotel_confirmed_at !== null) {
                throw ApiException::conflict('SUP-BR-21', 'Ya confirmó las habitaciones de esta rooming list.');
            }

            $confirmed = DB::table('ops_rooming_rooms')->where('rooming_list_id', $list->id)->where('status', '<>', 'observada')->update(['status' => 'confirmada', 'updated_by' => $account->user->getKey(), 'updated_at' => now()]);
            DB::table('ops_rooming_lists')->where('id', $list->id)->update([
                'hotel_ack_at' => $list->hotel_ack_at ?? now(),
                'hotel_ack_by' => $list->hotel_ack_by ?? $account->user->getKey(),
                'hotel_confirmed_at' => now(),
                'hotel_confirmed_by' => $account->user->getKey(),
                'updated_by' => $account->user->getKey(),
            ]);
            $this->audit->log('Rooming list', $list->reservation_code, 'confirmacion_hotel', null, "{$confirmed} hab. confirmadas");
            $this->notices->toOperations('rooming.confirmada', "{$account->provider->name} confirmó la rooming list {$list->reservation_code}", "{$confirmed} habitaciones confirmadas.", 'ops_rooming_list', $list->id, $list->reservation_id, $this->coordinator($list->reservation_id));

            return $confirmed;
        });
    }

    public function observe(SupplierAccount $account, string $roomId, array $data): string
    {
        return DB::transaction(function () use ($account, $roomId, $data): string {
            $room = $account->roomingRoom($roomId);
            $list = $this->current($account, $room->rooming_list_id, null);

            if ($room->status === 'observada') {
                throw ApiException::conflict('SUP-BR-22', "La habitación {$room->room_number} ya tiene una observación abierta.");
            }

            $proposal = trim((string) $data['proposal']);
            $service = DB::table('booking_reservation_services')->where('reservation_id', $room->reservation_id)->where('provider_id', $account->id())->where('service_kind', 'alojamiento')->whereNotIn('status', ['cancelado'])->orderBy('service_date')->value('id');
            $code = $this->incidents->open($account, [
                'reservation_id' => $room->reservation_id,
                'reservation_service_id' => $service,
                'type' => 'Proveedor',
                'severity' => $data['impact'],
                'title' => "Hotel observa hab. {$room->room_number} (".mb_strtolower((string) $data['reason']).')',
                'description' => $proposal,
            ]);
            DB::table('ops_rooming_rooms')->where('id', $room->id)->update([
                'status' => 'observada',
                'hotel_note' => "{$data['reason']}: {$proposal}",
                'incident_id' => DB::table('ops_incidents')->where('code', $code)->value('id'),
                'updated_by' => $account->user->getKey(),
                'updated_at' => now(),
            ]);
            DB::table('ops_rooming_lists')->where('id', $list->id)->update(['updated_by' => $account->user->getKey()]);
            $this->audit->log('Rooming list', $list->reservation_code, 'observacion_hotel', "hab. {$room->room_number}", (string) $data['reason']);

            return $code;
        });
    }

    private function current(SupplierAccount $account, string $id, ?int $version): object
    {
        $list = $account->roomingList($id);

        if ($version !== null) {
            IfMatch::assertMatches($version, (int) $list->lock_version, 'La rooming list');
        }

        if ($list->status === 'modificada') {
            throw ApiException::conflict('SUP-BR-20', 'La agencia está modificando esta rooming list. Espere el reenvío para responder.');
        }

        return $list;
    }

    private function coordinator(string $reservationId): ?string
    {
        $id = DB::table('ops_orders')->where('reservation_id', $reservationId)->whereNull('deleted_at')->value('coordinator_id');

        return $id === null ? null : (string) $id;
    }
}
