<?php

declare(strict_types=1);

namespace App\Domain\Operations\Support;

use App\Domain\Admin\Support\StaffNotices;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class OpsNotices
{
    public const CHANNELS = ['push', 'whatsapp'];

    public const CRITICAL = 'incidencia.critica';

    public function __construct(private readonly StaffNotices $notices) {}

    public function toOperations(string $event, string $subject, ?string $body, string $sourceType, string $sourceId, ?string $reservationId = null, ?string $coordinatorId = null, bool $managers = false): int
    {
        $roles = $managers ? ['operations', ...StaffNotices::MANAGERS] : ['operations'];
        $sent = $this->notices->toRoles($roles, $event, $subject, $body, $sourceType, $sourceId, $reservationId, [$coordinatorId]);

        if ($managers && $event === self::CRITICAL) {
            $this->criticalWhatsapp($subject, $body, $sourceType, $sourceId, $reservationId);
        }

        return $sent;
    }

    public function toUsers(Collection $userIds, string $event, string $subject, ?string $body, string $sourceType, string $sourceId, ?string $reservationId = null): int
    {
        return $this->notices->toUsers($userIds, $event, $subject, $body, $sourceType, $sourceId, $reservationId);
    }

    public function whatsappResources(?string $guideId, ?string $driverId, string $event, string $subject, string $body, string $assignmentId, ?string $reservationId): array
    {
        $guide = $guideId === null ? null : DB::table('ops_guides as g')->leftJoin('iam_users as u', fn ($join) => $join->on('u.guide_id', '=', 'g.id')->whereNull('u.deleted_at'))
            ->where('g.id', $guideId)->first(['g.phone', 'g.user_id', 'u.id as linked_user', 'u.phone as user_phone']);
        $driver = $driverId === null ? null : DB::table('ops_drivers as d')->leftJoin('iam_users as u', fn ($join) => $join->on('u.driver_id', '=', 'd.id')->whereNull('u.deleted_at'))
            ->where('d.id', $driverId)->first(['d.phone', 'd.user_id', 'u.id as linked_user', 'u.phone as user_phone']);
        $recipients = collect([$guide, $driver])->filter()->map(fn (object $row): array => [
            'user_id' => ($row->linked_user ?? $row->user_id) === null ? null : (string) ($row->linked_user ?? $row->user_id),
            'phone' => filled($row->phone) ? (string) $row->phone : ($row->user_phone === null ? null : (string) $row->user_phone),
        ]);

        return $this->notices->whatsapp($recipients, $event, $subject, $body, 'ops_assignment', $assignmentId, $reservationId);
    }

    private function criticalWhatsapp(string $subject, ?string $body, string $sourceType, string $sourceId, ?string $reservationId): void
    {
        $managers = DB::table('iam_users as u')->join('model_has_roles as mr', 'mr.model_id', '=', 'u.id')->join('roles as r', 'r.id', '=', 'mr.role_id')
            ->whereIn('r.name', StaffNotices::MANAGERS)->where('u.status', 'activo')->whereNull('u.deleted_at')->distinct()->get(['u.id', 'u.phone'])
            ->map(fn (object $user): array => ['user_id' => (string) $user->id, 'phone' => $user->phone]);
        $text = trim($subject.($body ? ". {$body}" : ''));
        $result = $this->notices->whatsapp($managers, self::CRITICAL, $subject, $text, $sourceType, $sourceId, $reservationId);

        if ($sourceType !== 'ops_incident' || $managers->isEmpty()) {
            return;
        }

        $message = match (true) {
            $result['skipped'] !== null => 'WhatsApp a gerencia no enviado: '.$result['skipped'],
            $result['queued'] > 0 => 'WhatsApp a gerencia en cola para '.$result['queued'].($result['queued'] === 1 ? ' persona.' : ' personas.'),
            default => 'WhatsApp a gerencia no enviado: '.StaffNotices::WHATSAPP_NO_PHONE,
        };
        DB::table('ops_incident_logs')->insert(['incident_id' => $sourceId, 'kind' => 'alerta', 'message' => $message, 'visibility' => 'interna']);
    }
}
