<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Support;

use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Shared\Audit\AuditLogger;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class PushTickets
{
    public const UNREGISTERED = 'DeviceNotRegistered';

    public function __construct(private readonly AuditLogger $audit) {}

    public static function devices(array $userIds): Collection
    {
        return DB::table('ops_mobile_devices')->whereIn('user_id', $userIds)->whereNull('revoked_at')->whereNotNull('expo_push_token')->orderByDesc('last_seen_at')->get(['id', 'expo_push_token'])->unique('expo_push_token')->values();
    }

    public function record(AdapterResult $result, Collection $devices): void
    {
        $byToken = $devices->pluck('id', 'expo_push_token');

        foreach ((array) ($result->payload['tickets'] ?? []) as $ticket) {
            $device = $byToken->get((string) ($ticket['token'] ?? ''));

            if (($ticket['error'] ?? null) === self::UNREGISTERED) {
                $this->deactivate($device === null ? [] : [(string) $device], 'aviso de Expo al enviar');

                continue;
            }

            if (blank($ticket['id'] ?? null) || ($ticket['status'] ?? null) !== 'ok') {
                continue;
            }

            DB::table('ops_push_tickets')->insertOrIgnore(['id' => (string) Str::uuid7(), 'device_id' => $device, 'ticket_id' => mb_substr((string) $ticket['id'], 0, 80), 'status' => 'pendiente', 'created_at' => now()]);
        }
    }

    public function deactivate(array $deviceIds, string $source): int
    {
        $devices = DB::table('ops_mobile_devices')->whereIn('id', array_filter($deviceIds))->whereNull('revoked_at')->get(['id', 'platform', 'app']);

        foreach ($devices as $device) {
            DB::table('ops_mobile_devices')->where('id', $device->id)->update(['revoked_at' => now(), 'expo_push_token' => null, 'updated_at' => now()]);
            $this->audit->log('Dispositivo móvil', mb_substr("{$device->app} · {$device->platform} · ".substr((string) $device->id, -8), 0, 80), 'desactivar', 'activo', "no registrado en Expo · {$source}");
        }

        return $devices->count();
    }
}
