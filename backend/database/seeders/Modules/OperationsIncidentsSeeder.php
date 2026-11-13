<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Booking\Support\ReservationIncidents;
use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class OperationsIncidentsSeeder
{
    use SeedsTenant;

    private const FIELD_ROLES = ['guide', 'driver'];

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    protected function shift(): int
    {
        return $this->shiftDays ??= OperationsTimeline::shift($this->tenant) ?? (int) Carbon::parse(self::KIT_TODAY)->diffInDays(Carbon::today(), false);
    }

    public function run(): void
    {
        (new OperationsOrdersSeeder($this->tenant))->run();

        foreach (KitSeeds::read('incidents') as $seed) {
            $incident = DB::table('ops_incidents')->where('tenant_id', $this->tenant->getKey())->where('code', $seed['id'])->first(['id', 'resolution', 'reported_by']);

            if ($incident === null) {
                continue;
            }

            $orderId = $this->idByCode('ops_orders', $seed['opId']);
            $reporter = $this->userId($seed['reportedBy']);
            $source = $this->sourceFor($seed['reportedBy']);
            $last = end($seed['log']);
            DB::table('ops_incidents')->where('id', $incident->id)->update([
                'order_id' => $orderId,
                'source' => $source,
                'reported_by' => $reporter,
                'resolution' => $incident->resolution ?? ($seed['status'] === 'cerrada' && $last ? trim(Str::after($last['m'], ':')) : null),
                'resolved_at' => $seed['status'] === 'cerrada' && $last ? $this->moment($last['ts']) : null,
                'resolved_by' => $seed['status'] === 'cerrada' && $last ? $this->userId($last['u']) : null,
                'closed_by' => $seed['status'] === 'cerrada' && $last ? $this->userId($last['u']) : null,
            ]);

            foreach ($seed['log'] as $index => $entry) {
                $this->log($incident->id, $index, $entry, $seed['status'], count($seed['log']));
            }

            foreach ($seed['evidence'] as $file) {
                $this->evidence($incident->id, $orderId, $file, $seed, $reporter, $source);
            }
        }

        DB::table('booking_reservations as r')->where('r.tenant_id', $this->tenant->getKey())->whereIn('r.status', ['confirmada', 'en_operacion', 'parcial'])
            ->whereExists(fn ($query) => $query->from('ops_incidents as i')->whereColumn('i.reservation_id', 'r.id')->whereIn('i.severity', ReservationIncidents::HIGH_SEVERITIES)->whereIn('i.status', ReservationIncidents::OPEN_STATUSES))
            ->update(['status' => 'incidencia']);
    }

    private function log(string $incidentId, int $index, array $entry, string $status, int $total): void
    {
        $at = $this->moment($entry['ts']);
        $exists = DB::table('ops_incident_logs')->where('incident_id', $incidentId)->where('message', $entry['m'])->exists();

        if ($exists) {
            return;
        }

        $kind = match (true) {
            $index === 0 => 'registro',
            $status === 'cerrada' && $index === $total - 1 => 'estado',
            default => 'comentario',
        };

        DB::table('ops_incident_logs')->insert([
            'id' => (string) Str::uuid7(),
            'tenant_id' => $this->tenant->getKey(),
            'incident_id' => $incidentId,
            'user_id' => $this->userId($entry['u']),
            'kind' => $kind,
            'message' => $entry['m'],
            'visibility' => 'interna',
            'created_by' => $this->userId($entry['u']),
            'created_at' => $at,
        ]);
    }

    private function evidence(string $incidentId, ?string $orderId, string $file, array $seed, ?string $reporter, string $source): void
    {
        $extension = Str::lower(pathinfo($file, PATHINFO_EXTENSION));
        $sha = hash('sha256', $seed['id'].'/'.$file);
        $this->upsert('ops_evidences', ['incident_id' => $incidentId, 'file_name' => $file], [
            'order_id' => $orderId,
            'storage_path' => "tenants/{$this->tenant->getKey()}/ops/evidences/{$sha}.{$extension}",
            'mime_type' => $extension === 'pdf' ? 'application/pdf' : ($extension === 'png' ? 'image/png' : 'image/jpeg'),
            'size_bytes' => 184000,
            'sha256' => $sha,
            'source' => $source === 'app_operador' ? 'app_operador' : ($source === 'extranet' ? 'extranet' : 'web'),
            'captured_at' => $this->moment($seed['createdAt']),
            'uploaded_by' => $reporter,
            'created_by' => $reporter,
        ]);
    }

    private function sourceFor(string $code): string
    {
        $role = DB::table('iam_users as u')->join('model_has_roles as mr', 'mr.model_id', '=', 'u.id')->join('roles as r', 'r.id', '=', 'mr.role_id')
            ->where('u.tenant_id', $this->tenant->getKey())->where('u.code', $code)->value('r.name');

        return match (true) {
            in_array($role, self::FIELD_ROLES, true) => 'app_operador',
            $role === 'provider' => 'extranet',
            default => 'web',
        };
    }
}
