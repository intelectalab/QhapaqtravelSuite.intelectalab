<?php

declare(strict_types=1);

namespace App\Domain\Mobile\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class MobileDeviceController
{
    public function revoke(Request $request, string $id, AuditLogger $audit): JsonResponse
    {
        $user = $request->user();
        assert($user instanceof User);
        $device = Str::isUuid($id) ? DB::table('ops_mobile_devices as m')->join('iam_users as u', 'u.id', '=', 'm.user_id')->where('m.id', $id)->where('m.app', 'operador')->first(['m.id', 'm.revoked_at', 'm.platform', 'm.app_version', 'u.name']) : null;

        if ($device === null) {
            throw ApiException::notFound('El teléfono no existe.');
        }

        if ($device->revoked_at !== null) {
            throw ApiException::conflict('MOB-DEVICE-01', 'Este teléfono ya estaba desactivado.');
        }

        DB::transaction(function () use ($device, $user, $audit): void {
            DB::table('ops_mobile_devices')->where('id', $device->id)->update(['revoked_at' => now(), 'expo_push_token' => null, 'updated_by' => $user->getKey(), 'updated_at' => now()]);
            $audit->log('Dispositivo móvil', (string) $device->id, 'revocar', 'activo', "revocado · {$device->name} · {$device->platform} {$device->app_version}");
        });

        return response()->json(['data' => ['id' => $device->id, 'revoked' => true]]);
    }
}
