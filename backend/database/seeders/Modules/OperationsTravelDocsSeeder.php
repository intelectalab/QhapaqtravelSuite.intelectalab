<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class OperationsTravelDocsSeeder
{
    use SeedsTenant;

    private const DOCUMENTS = ['id_doc', 'visa', 'insurance', 'yellow_fever', 'minor_auth', 'migration'];

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
        foreach (KitSeeds::read('travelDocs') as $seed) {
            $reservationId = $this->idByCode('booking_reservations', $seed['resId']);

            if ($reservationId === null) {
                continue;
            }

            $passengers = DB::table('booking_passengers')->where('reservation_id', $reservationId)->orderBy('seq')->get(['id', 'full_name']);

            foreach ($seed['pax'] as $index => $pax) {
                $passenger = $passengers->firstWhere('full_name', $pax['name']) ?? $passengers->get($index);

                if ($passenger !== null) {
                    $this->passenger($reservationId, $passenger->id, $pax['items']);
                }
            }

            foreach ($seed['reminders'] as $reminder) {
                $this->reminder($reservationId, $reminder, count($seed['pax']));
            }
        }
    }

    private function passenger(string $reservationId, string $passengerId, array $items): void
    {
        foreach ($items as $type => $item) {
            if (in_array($type, self::DOCUMENTS, true)) {
                $file = $item['file'] ?? null;
                $this->upsert('ops_travel_doc_items', ['passenger_id' => $passengerId, 'doc_type' => $type], [
                    'reservation_id' => $reservationId,
                    'status' => $item['status'] ?? 'pendiente',
                    'doc_number' => ($item['number'] ?? '') ?: null,
                    'expiry_date' => ($item['expiry'] ?? '') ? $this->day($item['expiry']) : null,
                    'file_name' => $file['name'] ?? null,
                    'uploaded_by_type' => $file ? 'client' : null,
                    'validated_by' => isset($item['validatedBy']) ? $this->userId($item['validatedBy']) : null,
                    'validated_at' => isset($item['validatedAt']) ? $this->moment($item['validatedAt']) : null,
                    'note' => isset($item['note']) ? mb_substr($item['note'], 0, 200) : null,
                ]);
            }
        }

        if (! empty($items['emergency']['name']) && ! empty($items['emergency']['phone'])) {
            $this->upsert('ops_travel_doc_contacts', ['passenger_id' => $passengerId], [
                'name' => $items['emergency']['name'],
                'phone' => $items['emergency']['phone'],
                'relation' => $items['emergency']['relation'] ?? 'Otro',
            ]);
        }

        if (isset($items['special'])) {
            $this->upsert('ops_travel_doc_special', ['passenger_id' => $passengerId], [
                'requires_attention' => (bool) ($items['special']['flag'] ?? false),
                'operational_note' => ($items['special']['note'] ?? '') ?: null,
            ]);
        }
    }

    private function reminder(string $reservationId, array $reminder, int $items): void
    {
        $manual = str_starts_with((string) $reminder['by'], 'U');
        preg_match('/(\d+) días/', (string) $reminder['kind'], $days);
        $this->upsert('ops_travel_doc_reminders', ['reservation_id' => $reservationId, 'sent_at' => $this->moment($reminder['ts'])], [
            'sent_on' => $this->day(substr($reminder['ts'], 0, 10)),
            'channels' => $reminder['channel'],
            'recipient' => $reminder['to'],
            'trigger' => $manual ? 'manual' : 'auto',
            'days_before' => isset($days[1]) ? (int) $days[1] : null,
            'items_count' => $items,
            'sent_by' => $manual ? $this->userId($reminder['by']) : null,
        ]);
    }
}
