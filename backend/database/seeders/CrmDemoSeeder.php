<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CrmDemoSeeder
{
    private const KIT_TODAY = '2026-09-29';

    private const DOC_TYPES = ['DNI' => 'DNI', 'RUC' => 'RUC', 'Pasaporte' => 'PASAPORTE', 'Passport' => 'PASAPORTE', 'CE' => 'CE'];

    private const SLA_HOURS = ['critica' => 2, 'alta' => 4, 'media' => 12, 'baja' => 24];

    private int $shift;

    private float $fx;

    private array $users = [];

    private array $sedes = [];

    private array $clients = [];

    private array $reservations = [];

    public function __construct(private readonly Tenant $tenant)
    {
        $this->shift = (int) Carbon::parse(self::KIT_TODAY)->diffInDays(Carbon::today(), false);
        $this->fx = (float) (KitSeeds::read('tenant')['fx'] ?? 3.75);
    }

    public function run(): void
    {
        $this->users = DB::table('iam_users')->where('tenant_id', $this->tenant->getKey())->pluck('id', 'code')->all();
        $this->sedes = DB::table('iam_sedes')->where('tenant_id', $this->tenant->getKey())->pluck('id', 'code')->all();

        $this->seedClients();
        $this->seedReservations();
        $this->seedQuotes();
        $this->seedReceivables();
        $this->seedIncidents();
    }

    private function seedClients(): void
    {
        foreach (KitSeeds::read('clients') as $seed) {
            [$type, $number] = $this->document($seed['doc']);
            $this->clients[$seed['id']] = $this->insert('crm_clients', ['code' => $seed['id']], [
                'kind' => Str::lower($seed['kind']),
                'name' => preg_replace('/\s*\(agencia B2B\)$/i', '', $seed['name']),
                'doc_type' => self::DOC_TYPES[$type] ?? 'DNI',
                'doc_number' => $number,
                'email' => $seed['email'] ?: null,
                'phone' => $seed['phone'] ?: null,
                'phone_norm' => substr(preg_replace('/\D/', '', (string) $seed['phone']), -9) ?: null,
                'country' => $seed['country'],
                'city' => $seed['city'] ?: null,
                'birth_date' => $seed['birth'] ?? null,
                'segment_code' => $seed['segment'],
                'owner_id' => $this->user($seed['owner']),
                'tags' => '{'.implode(',', array_map(fn ($tag) => '"'.str_replace('"', '', $tag).'"', $seed['tags'] ?? [])).'}',
                'nps_last' => $seed['nps'] ?? null,
                'created_at' => $this->date($seed['createdAt']),
            ]);
        }
    }

    private function seedReservations(): void
    {
        foreach (KitSeeds::read('reservations') as $seed) {
            $created = $this->date($seed['createdAt']);
            $id = $this->insert('booking_reservations', ['code' => $seed['id']], [
                'client_id' => $this->clients[$seed['clientId']],
                'owner_id' => $this->user($seed['owner']),
                'sede_id' => $this->sedes[$seed['sede']] ?? reset($this->sedes),
                'title' => $this->text(preg_replace('/\s*\(web\)$/', '', $seed['title'])),
                'status' => $seed['status'],
                'channel' => $seed['channel'] ?? 'Directo',
                'travel_from' => $this->day($seed['travelFrom']),
                'travel_to' => $this->day($seed['travelTo']),
                'currency' => $seed['currency'],
                'fx_rate' => $seed['currency'] === 'USD' ? $this->fx : 1,
                'total_amount' => $seed['total'],
                'snapshot_label' => Str::limit($this->text($seed['title']), 290),
                'notes' => isset($seed['notes']) ? $this->text($seed['notes']) : null,
                'cancelled_at' => $seed['status'] === 'cancelada' ? ($this->date($seed['cancelledAt'] ?? null) ?? $created) : null,
                'cancel_reason' => $seed['status'] === 'cancelada' ? ($seed['cancelReason'] ?? 'Cancelada por el cliente.') : null,
                'created_at' => $created,
            ]);
            $this->reservations[$seed['id']] = ['id' => $id, 'quote' => $seed['quoteId'] ?? null];

            DB::table('booking_passengers')->where('reservation_id', $id)->delete();
            foreach ($seed['passengers'] ?? [] as $index => $passenger) {
                [$type, $number] = $this->document($passenger['doc'] ?? '');
                DB::table('booking_passengers')->insert([
                    'tenant_id' => $this->tenant->getKey(),
                    'reservation_id' => $id,
                    'seq' => $index + 1,
                    'full_name' => $passenger['name'],
                    'doc_type' => $number === '' ? null : ($type === 'Passport' ? 'Passport' : ($type === 'Pasaporte' ? 'Pasaporte' : ($type === 'CE' ? 'CE' : 'DNI'))),
                    'doc_number' => $number ?: null,
                    'pax_type' => $passenger['type'] ?? 'ADT',
                    'nationality' => $passenger['nationality'] ?? null,
                    'birth_date' => $passenger['birth'] ?? null,
                    'phone' => $passenger['phone'] ?? null,
                    'email' => $passenger['email'] ?? null,
                    'diet_notes' => ($passenger['diet'] ?? '') ?: null,
                    'relationship' => $passenger['relationship'] ?? null,
                    'age' => $passenger['age'] ?? null,
                    'is_lead' => (bool) ($passenger['isLead'] ?? $index === 0),
                    'is_placeholder' => false,
                ]);
            }
        }
    }

    private function seedQuotes(): void
    {
        $byQuote = collect($this->reservations)->filter(fn ($reservation) => $reservation['quote'] !== null)->mapWithKeys(fn ($reservation) => [$reservation['quote'] => $reservation['id']]);

        foreach (KitSeeds::read('quotes') as $seed) {
            $reservation = $byQuote[$seed['id']] ?? null;
            $quoteId = $this->insert('quote_quotes', ['code' => $seed['id']], [
                'client_id' => $this->clients[$seed['clientId']],
                'owner_id' => $this->user($seed['owner']),
                'title' => $this->text($seed['title']),
                'status' => $seed['status'],
                'current_version_no' => $seed['currentVersion'] ?? 1,
                'travel_from' => $this->day($seed['travelFrom']),
                'travel_to' => $this->day($seed['travelTo'] ?? $seed['travelFrom']),
                'valid_until' => $this->day($seed['validUntil']),
                'currency' => $seed['currency'],
                'fx_rate' => $seed['currency'] === 'USD' ? $this->fx : 1,
                'pax_adt' => $seed['pax']['adt'] ?? 1,
                'pax_chd' => $seed['pax']['chd'] ?? 0,
                'pax_inf' => $seed['pax']['inf'] ?? 0,
                'viewed_at' => $this->date($seed['viewedAt'] ?? null),
                'rejected_at' => $seed['status'] === 'rechazada' ? $this->date($seed['createdAt']) : null,
                'rejected_reason' => $seed['status'] === 'rechazada' ? ($seed['rejectedReason'] ?? 'Sin motivo registrado.') : null,
                'reservation_id' => $reservation,
                'converted_at' => $reservation ? $this->date($seed['createdAt']) : null,
                'created_at' => $this->date($seed['createdAt']),
            ]);

            if ($reservation) {
                DB::table('booking_reservations')->where('id', $reservation)->update(['quote_id' => $quoteId]);
            }
        }
    }

    private function seedReceivables(): void
    {
        foreach (KitSeeds::read('receivables') as $seed) {
            $concept = Str::lower($seed['concept']);
            $this->insert('fin_receivables', ['code' => $seed['id']], [
                'reservation_id' => $this->reservations[$seed['resId']]['id'],
                'client_id' => $this->clients[$seed['clientId']],
                'kind' => str_contains($concept, 'saldo') ? 'saldo' : (str_contains($concept, 'adelanto') ? 'adelanto' : (str_contains($concept, 'anticipo') ? 'anticipo' : 'total')),
                'concept' => $this->text($seed['concept']),
                'amount' => $seed['amount'],
                'currency' => $seed['currency'],
                'fx_rate' => $seed['currency'] === 'USD' ? $this->fx : null,
                'paid_amount' => $seed['paid'],
                'due_date' => $this->day($seed['due']),
                'status' => $seed['status'],
            ]);
        }
    }

    private function seedIncidents(): void
    {
        foreach (KitSeeds::read('incidents') as $seed) {
            $created = Carbon::parse($this->date($seed['createdAt']));
            $hours = self::SLA_HOURS[$seed['severity']] ?? 24;
            $this->insert('ops_incidents', ['code' => $seed['id']], [
                'reservation_id' => $this->reservations[$seed['resId']]['id'] ?? null,
                'type' => $seed['type'],
                'severity' => $seed['severity'],
                'title' => $this->text($seed['title']),
                'description' => $this->text($seed['desc']),
                'status' => $seed['status'],
                'assignee_id' => isset($seed['assignee']) ? $this->user($seed['assignee']) : null,
                'reported_by' => $this->user($seed['reportedBy']),
                'sla_hours' => $hours,
                'sla_due_at' => $created->copy()->addHours($hours),
                'resolution' => $seed['resolution'] ?? null,
                'closed_at' => $seed['status'] === 'cerrada' ? $created->copy()->addHours($hours) : null,
                'created_at' => $created,
            ]);
        }
    }

    private function insert(string $table, array $key, array $values): string
    {
        $where = ['tenant_id' => $this->tenant->getKey(), ...$key];
        $existing = DB::table($table)->where($where)->value('id');

        if ($existing) {
            DB::table($table)->where('id', $existing)->update($values);

            return $existing;
        }

        $id = (string) Str::uuid7();
        DB::table($table)->insert(['id' => $id, ...$where, ...$values]);

        return $id;
    }

    private function document(string $value): array
    {
        $parts = preg_split('/\s+/', trim($value), 2);

        return count($parts) === 2 ? [$parts[0], str_replace(' ', '', $parts[1])] : ['DNI', str_replace(' ', '', $value)];
    }

    private function user(string $code): string
    {
        return $this->users[$code] ?? reset($this->users);
    }

    private function text(string $value): string
    {
        return preg_replace_callback('#(?<![\d/])(\d{1,2})/(\d{1,2})(?![\d/])#', function (array $match): string {
            $date = Carbon::create((int) substr(self::KIT_TODAY, 0, 4), (int) $match[2], (int) $match[1])->addDays($this->shift);

            return $date->format('d/m');
        }, $value) ?? $value;
    }

    private function day(?string $date): ?string
    {
        return $date ? Carbon::parse($date)->addDays($this->shift)->toDateString() : null;
    }

    private function date(?string $value): ?string
    {
        return $value ? Carbon::parse($value, 'America/Lima')->addDays($this->shift)->toIso8601String() : null;
    }
}
