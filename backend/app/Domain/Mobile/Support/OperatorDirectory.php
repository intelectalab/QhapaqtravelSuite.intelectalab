<?php

declare(strict_types=1);

namespace App\Domain\Mobile\Support;

use App\Domain\Operations\Support\OpsCommon;
use App\Domain\Shared\Errors\ApiException;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class OperatorDirectory
{
    public const PAST_DAYS = 2;

    public const NEXT_DAYS = 14;

    public function __construct(private readonly OpsCommon $common) {}

    public function me(OperatorResource $resource): array
    {
        $row = $resource->row;
        $today = $this->common->today();
        $expires = $resource->type === 'driver' ? $row->license_expires_on : null;

        return [
            'type' => $resource->type,
            'role' => $resource->type === 'guide' ? 'Guía' : 'Conductor',
            'id' => $resource->id(),
            'code' => $row->code,
            'name' => $row->full_name,
            'phone' => $row->phone,
            'status' => $row->status,
            'license' => $row->license_number,
            'license_class' => $row->license_class ?? null,
            'license_expires_on' => $expires,
            'license_state' => $expires === null ? null : ($expires < $today ? 'vencido' : ($expires <= CarbonImmutable::parse($today)->addDays(30)->toDateString() ? 'por_vencer' : 'vigente')),
            'languages' => $resource->type === 'guide' ? array_values(array_filter(explode(',', trim((string) $row->languages, '{}')))) : [],
            'user' => ['name' => $resource->user->getAttribute('name'), 'email' => $resource->user->getAttribute('email')],
            'today' => $today,
        ];
    }

    public function bootstrap(OperatorResource $resource, ?string $since, array $known): array
    {
        $today = CarbonImmutable::parse($this->common->today());
        $from = $today->subDays(self::PAST_DAYS)->toDateString();
        $to = $today->addDays(self::NEXT_DAYS)->toDateString();
        $ids = (clone $resource->assignments())->whereBetween('a.service_date', [$from, $to])->pluck('a.id')->map(fn (mixed $id): string => (string) $id);
        $changed = $since === null ? $ids : (clone $resource->assignments())->whereIn('a.id', $ids->all())
            ->where(fn ($query) => $query->where('a.updated_at', '>', $since)->orWhere('s.updated_at', '>', $since)->orWhere('o.updated_at', '>', $since))
            ->pluck('a.id')->map(fn (mixed $id): string => (string) $id);

        return [
            'cursor' => now()->toIso8601String(),
            'window' => ['from' => $from, 'to' => $to],
            'me' => $this->me($resource),
            'assignments' => $changed->map(fn (string $id): array => $this->detail($resource, $id))->values(),
            'tombstones' => collect($known)->map(fn (mixed $id): string => (string) $id)->diff($ids)->values(),
            'incidents' => $this->incidents($resource),
        ];
    }

    public function detail(OperatorResource $resource, string $id): array
    {
        if (! Str::isUuid($id)) {
            throw ApiException::notFound('La asignación no existe.');
        }

        $row = (clone $resource->assignments())->where('a.id', $id)
            ->leftJoin('ops_guides as g', 'g.id', '=', 'a.guide_id')
            ->leftJoin('ops_drivers as d', 'd.id', '=', 'a.driver_id')
            ->leftJoin('ops_vehicles as v', 'v.id', '=', 'a.vehicle_id')
            ->leftJoin('iam_users as c', 'c.id', '=', 'o.coordinator_id')
            ->leftJoin('catalog_providers as p', 'p.id', '=', 's.provider_id')
            ->first([
                'a.id', 'a.status', 'a.lock_version', 'a.service_date', 'a.service_time', 'a.service_label', 'a.confirmed_at', 'a.started_at', 'a.first_checkin_at', 'a.finished_at', 'a.updated_at', 'a.reservation_service_id',
                'o.id as order_id', 'o.code as order_code', 'o.title as order_title', 'o.status as order_status', 'r.id as reservation_id', 'r.code as reservation_code', 'r.notes as reservation_notes',
                's.code as service_code', 's.name as service_name', 's.service_kind', 's.status as service_status', 's.confirmation_code', 'p.name as provider_name',
                'g.id as guide_id', 'g.full_name as guide_name', 'g.phone as guide_phone', 'd.id as driver_id', 'd.full_name as driver_name', 'd.phone as driver_phone', 'v.plate', 'v.vehicle_type',
                'c.name as coordinator_name', 'c.phone as coordinator_phone',
            ]) ?? throw ApiException::notFound('Esta asignación ya no es suya. Vuelva a la vista de hoy.');

        $passengers = DB::table('booking_passengers')->where('reservation_id', $row->reservation_id)->orderBy('seq')->get(['id', 'full_name', 'pax_type', 'doc_type', 'doc_number', 'diet_notes', 'is_lead', 'phone']);
        $checkins = DB::table('ops_assignment_checkins')->where('assignment_id', $row->id)->whereNull('undone_at')->get(['passenger_id', 'checked_at', 'source'])->keyBy('passenger_id');
        $evidences = DB::table('ops_evidences')->where('order_id', $row->order_id)->where('reservation_service_id', $row->reservation_service_id)->whereNull('removed_at')->orderBy('captured_at')->get(['id', 'file_name', 'mime_type', 'sha256', 'captured_at', 'source']);
        $done = $row->status === 'completada';
        $partner = $resource->type === 'guide'
            ? ($row->driver_name ? ['role' => 'Conductor', 'name' => $row->driver_name, 'phone' => $row->driver_phone] : null)
            : ($row->guide_name ? ['role' => 'Guía', 'name' => $row->guide_name, 'phone' => $row->guide_phone] : null);

        return [
            'id' => $row->id,
            'status' => $row->status,
            'lock_version' => (int) $row->lock_version,
            'date' => $row->service_date,
            'time' => OpsCommon::time($row->service_time),
            'label' => $row->service_label,
            'kind' => $row->service_kind,
            'service' => ['code' => $row->service_code, 'name' => $row->service_name, 'status' => $row->service_status, 'confirmation' => $row->confirmation_code, 'provider' => $row->provider_name],
            'order' => ['code' => $row->order_code, 'title' => $row->order_title, 'status' => $row->order_status],
            'reservation' => $row->reservation_code,
            'notes' => $row->reservation_notes,
            'vehicle' => $row->plate ? "{$row->plate} · {$row->vehicle_type}" : null,
            'partner' => $partner,
            'coordinator' => $row->coordinator_name ? ['name' => $row->coordinator_name, 'phone' => $row->coordinator_phone] : null,
            'confirmed_at' => $row->confirmed_at,
            'started_at' => $row->started_at,
            'first_checkin_at' => $row->first_checkin_at,
            'finished_at' => $row->finished_at,
            'updated_at' => $row->updated_at,
            'passengers' => $passengers->map(fn (object $pax): array => [
                'id' => $pax->id,
                'name' => $pax->full_name,
                'type' => $pax->pax_type,
                'doc' => $pax->doc_number ? trim("{$pax->doc_type} {$pax->doc_number}") : null,
                'diet' => $pax->diet_notes,
                'lead' => (bool) $pax->is_lead,
                'phone' => $pax->is_lead ? $pax->phone : null,
                'checked_at' => $checkins[$pax->id]->checked_at ?? null,
                'no_show' => $done && ! isset($checkins[$pax->id]),
            ])->values(),
            'checked_in' => $checkins->count(),
            'evidences' => $evidences->map(fn (object $file): array => ['id' => $file->id, 'name' => $file->file_name, 'mime' => $file->mime_type, 'sha256' => $file->sha256, 'captured_at' => $file->captured_at, 'source' => $file->source])->values(),
            'can' => [
                'confirm' => in_array($row->status, ['asignada', 'pendiente'], true),
                'start' => $row->status === 'confirmada',
                'checkin' => $row->status === 'en_curso',
                'evidence' => in_array($row->status, ['en_curso', 'completada'], true),
                'finish' => $row->status === 'en_curso' && $checkins->isNotEmpty() && $evidences->isNotEmpty(),
            ],
        ];
    }

    public function incidents(OperatorResource $resource): Collection
    {
        $orders = (clone $resource->assignments())->distinct()->pluck('o.id');

        return DB::table('ops_incidents as i')->leftJoin('ops_orders as o', 'o.id', '=', 'i.order_id')
            ->where(fn ($query) => $query->whereIn('i.order_id', $orders->all())->orWhere('i.reported_by', $resource->user->getKey()))
            ->orderByDesc('i.created_at')->limit(50)
            ->get(['i.code', 'i.type', 'i.severity', 'i.title', 'i.status', 'i.source', 'i.created_at', 'i.sla_due_at', 'i.related_incident_id', 'o.code as order_code'])
            ->map(fn (object $row): array => ['code' => $row->code, 'type' => $row->type, 'severity' => $row->severity, 'title' => $row->title, 'status' => $row->status, 'source' => $row->source, 'created_at' => $row->created_at, 'sla_due_at' => $row->sla_due_at, 'order' => $row->order_code, 'related' => $row->related_incident_id !== null])
            ->values();
    }
}
