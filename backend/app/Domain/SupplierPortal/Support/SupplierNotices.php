<?php

declare(strict_types=1);

namespace App\Domain\SupplierPortal\Support;

use App\Domain\Admin\Support\StaffNotices;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class SupplierNotices
{
    public const EVENTS = [
        'proveedor.solicitud' => ['kind' => 'request', 'tone' => 'warn', 'href' => '/proveedor/solicitudes'],
        'rooming.enviado' => ['kind' => 'rooming', 'tone' => 'warn', 'href' => '/proveedor/rooming'],
        'voucher.emitido' => ['kind' => 'voucher', 'tone' => 'ok', 'href' => '/proveedor/vouchers'],
        'voucher.actualizado' => ['kind' => 'voucher', 'tone' => 'info', 'href' => '/proveedor/vouchers'],
        'voucher.anulado' => ['kind' => 'voucher', 'tone' => 'bad', 'href' => '/proveedor/vouchers'],
    ];

    public const RECENT_DAYS = 14;

    public function __construct(private readonly StaffNotices $notices) {}

    public function toProvider(?string $providerId, string $event, string $subject, ?string $body, string $sourceType, string $sourceId, ?string $reservationId = null): int
    {
        if ($providerId === null || $providerId === '') {
            return 0;
        }

        $users = DB::table('iam_users')->where('provider_id', $providerId)->where('status', 'activo')->whereNull('deleted_at')->pluck('id');

        return $this->notices->toUsers($users, $event, $subject, $body, $sourceType, $sourceId, $reservationId);
    }

    public function recent(SupplierAccount $account, int $limit = 5): array
    {
        return DB::table('notif_messages')->where('recipient_user_id', $account->user->getKey())->where('channel', 'portal')
            ->whereIn('event_code', array_keys(self::EVENTS))->where('created_at', '>=', Carbon::now()->subDays(self::RECENT_DAYS))
            ->orderByDesc('created_at')->limit($limit)->get(['event_code', 'subject', 'body_rendered', 'created_at'])
            ->map(fn (object $row): array => [
                ...self::EVENTS[$row->event_code],
                'title' => (string) $row->subject,
                'detail' => trim((string) strtok((string) $row->body_rendered, "\n")) ?: 'Revise el detalle en la extranet.',
                'at' => Carbon::parse($row->created_at)->toIso8601String(),
            ])->values()->all();
    }
}
