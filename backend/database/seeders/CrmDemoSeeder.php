<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Domain\Platform\Models\Tenant;
use App\Domain\Quotes\Support\QuotePricing;
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

    private array $opportunities = [];

    private array $leads = [];

    private array $quotes = [];

    public function __construct(private readonly Tenant $tenant)
    {
        $this->shift = (int) Carbon::parse(self::KIT_TODAY)->diffInDays(Carbon::parse(Carbon::today('America/Lima')->toDateString()), false);
        $this->fx = (float) (KitSeeds::read('tenant')['fx'] ?? 3.75);
    }

    public function run(): void
    {
        $this->users = DB::table('iam_users')->where('tenant_id', $this->tenant->getKey())->pluck('id', 'code')->all();
        $this->sedes = DB::table('iam_sedes')->where('tenant_id', $this->tenant->getKey())->pluck('id', 'code')->all();

        $this->seedFxRate();
        $this->seedClients();
        $this->seedStages();
        $this->seedOpportunities();
        $this->seedLeads();
        $this->seedReservations();
        $this->seedQuotes();
        $this->seedReceivables();
        $this->seedIncidents();
        $this->seedActivities();
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

    private function seedFxRate(): void
    {
        if (DB::table('fin_fx_rates')->where('tenant_id', $this->tenant->getKey())->where('currency_code', 'USD')->exists()) {
            return;
        }

        DB::table('fin_fx_rates')->insert([
            'id' => (string) Str::uuid7(),
            'tenant_id' => $this->tenant->getKey(),
            'currency_code' => 'USD',
            'base_currency' => 'PEN',
            'rate_pen' => $this->fx,
            'rate_date' => Carbon::today()->toDateString(),
            'source' => 'Manual diario (SBS referencial)',
        ]);
    }

    private function seedStages(): void
    {
        foreach (KitSeeds::read('stages') as $index => $stage) {
            $this->insert('crm_pipeline_stages', ['code' => $stage['id']], [
                'name' => $stage['name'],
                'default_probability' => $stage['prob'],
                'sort_order' => $index + 1,
                'is_closed' => in_array($stage['id'], ['ganada', 'perdida'], true),
            ]);
        }
    }

    private function seedOpportunities(): void
    {
        foreach (KitSeeds::read('opportunities') as $seed) {
            $closed = in_array($seed['stage'], ['ganada', 'perdida'], true);
            $this->opportunities[$seed['id']] = $this->insert('crm_opportunities', ['code' => $seed['id']], [
                'client_id' => $this->clients[$seed['clientId']],
                'title' => $this->text($seed['title']),
                'stage' => $seed['stage'],
                'amount' => $seed['amount'],
                'currency' => $seed['currency'],
                'probability' => $seed['stage'] === 'ganada' ? 100 : ($seed['stage'] === 'perdida' ? 0 : $seed['probability']),
                'expected_close_date' => $this->day($seed['closeDate']),
                'closed_at' => $closed ? $this->day($seed['closeDate']) : null,
                'owner_id' => $this->user($seed['owner']),
                'destination_label' => $seed['destination'] ?? null,
                'pax' => $seed['pax'] ?? 0,
                'origin' => $seed['leadId'] ? 'lead' : 'directo',
                'lost_reason_code' => $seed['stage'] === 'perdida' ? 'precio' : null,
                'lost_detail' => $seed['stage'] === 'perdida' ? ($seed['lostReason'] ?: null) : null,
                'lost_at_stage' => $seed['stage'] === 'perdida' ? 'cotizacion' : null,
                'created_at' => $this->date($seed['createdAt']),
            ]);
        }
    }

    private function seedLeads(): void
    {
        foreach (KitSeeds::read('leads') as $seed) {
            $status = $seed['status'];
            $owner = ($seed['owner'] ?? '') !== '' ? $this->user($seed['owner']) : null;
            $created = $this->date($seed['createdAt']);
            $duplicate = $seed['duplicateOf'] ?? null;
            $leadId = $this->leads[$seed['id']] = $this->insert('crm_leads', ['code' => $seed['id']], [
                'full_name' => $seed['name'],
                'company' => ($seed['company'] ?? '') ?: null,
                'email' => ($seed['email'] ?? '') ?: null,
                'phone' => ($seed['phone'] ?? '') ?: null,
                'phone_norm' => substr(preg_replace('/\D/', '', (string) ($seed['phone'] ?? '')), -9) ?: null,
                'channel_code' => CrmCatalogSeeder::code($seed['channel']),
                'source_code' => CrmCatalogSeeder::code($seed['source']),
                'interest_code' => CrmCatalogSeeder::code($seed['interest']),
                'destination_label' => ($seed['destination'] ?? '') ?: null,
                'travel_date' => ($seed['travelDate'] ?? '') !== '' ? $this->day($seed['travelDate']) : null,
                'pax' => $seed['pax'] ?? 0,
                'status' => $status,
                'owner_id' => $owner,
                'score' => $seed['score'] ?? 0,
                'notes' => ($seed['notes'] ?? '') ? $this->text($seed['notes']) : null,
                'duplicate_of_type' => $duplicate ? (str_starts_with($duplicate, 'CLI-') ? 'client' : 'lead') : null,
                'duplicate_of_id' => $duplicate ? ($this->clients[$duplicate] ?? null) : null,
                'validated_at' => $this->date($seed['validatedAt'] ?? $seed['createdAt']),
                'assigned_at' => $owner ? $created : null,
                'first_contact_at' => in_array($status, ['contactado', 'calificado', 'convertido'], true) ? $created : null,
                'discard_reason_code' => $status === 'descartado' ? CrmCatalogSeeder::code(CrmCatalogSeeder::ITEMS['discard_reason'][0]) : null,
                'discard_detail' => $status === 'descartado' ? ($seed['notes'] ?? null) : null,
                'discarded_at' => $status === 'descartado' ? $created : null,
                'converted_client_id' => $status === 'convertido' ? $this->clients[$seed['convertedClientId']] : null,
                'converted_opportunity_id' => $status === 'convertido' ? ($this->opportunities[$seed['convertedOppId']] ?? null) : null,
                'converted_at' => $status === 'convertido' ? $created : null,
                'converted_by' => $status === 'convertido' ? $owner : null,
                'created_at' => $created,
            ]);

            if ($status === 'convertido' && isset($this->opportunities[$seed['convertedOppId'] ?? ''])) {
                DB::table('crm_opportunities')->where('id', $this->opportunities[$seed['convertedOppId']])->update(['lead_id' => $leadId, 'origin' => 'lead']);
            }
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
            $this->seedServices($id, $seed);

            foreach ($seed['passengers'] ?? [] as $index => $passenger) {
                [$type, $number] = $this->document($passenger['doc'] ?? '');
                $this->insert('booking_passengers', ['reservation_id' => $id, 'seq' => $index + 1], [
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

    private function seedActivities(): void
    {
        $related = ['lead' => $this->leads, 'opportunity' => $this->opportunities, 'client' => $this->clients, 'quote' => $this->quotes];

        foreach (KitSeeds::read('activities') as $seed) {
            $due = Carbon::parse($this->date($seed['due']))->utc();
            $relatedId = $related[$seed['relType']][$seed['relId']] ?? null;
            $status = $seed['status'] === 'completada' ? 'completada' : ($due->isPast() ? 'vencida' : 'pendiente');
            $this->insert('crm_activities', ['code' => $seed['id']], [
                'type' => strtolower(Str::ascii($seed['type'])),
                'subject' => $this->text($seed['subject']),
                'related_type' => $relatedId ? $seed['relType'] : null,
                'related_id' => $relatedId,
                'owner_id' => $this->user($seed['owner']),
                'due_at' => $due,
                'status' => $status,
                'result' => $status === 'completada' ? (($seed['result'] ?? '') ?: 'Hecho.') : null,
                'completed_at' => $status === 'completada' ? $due : null,
                'completed_by' => $status === 'completada' ? $this->user($seed['owner']) : null,
                'created_at' => $due->copy()->subDay(),
            ]);
        }
    }

    private function seedServices(string $reservationId, array $seed): void
    {
        $providers = DB::table('catalog_providers')->where('tenant_id', $this->tenant->getKey())->pluck('id', 'ref')->all();

        foreach ($seed['services'] ?? [] as $service) {
            $status = $service['status'];
            $code = ($service['confirmationCode'] ?? '') ?: null;
            $kind = $this->serviceKind($service);
            $this->insert('booking_reservation_services', ['code' => $service['id']], [
                'reservation_id' => $reservationId,
                'provider_id' => $providers[$service['providerId'] ?? ''] ?? null,
                'requires_assignment' => in_array($kind, ['tour', 'traslado'], true),
                'name' => Str::limit($service['name'], 195),
                'service_date' => $this->day($service['date']),
                'service_time' => preg_match('/^\d{1,2}:\d{2}$/', (string) ($service['time'] ?? '')) ? $service['time'] : null,
                'pax' => count($seed['passengers'] ?? []) ?: null,
                'status' => $status === 'confirmado' && $code === null ? 'completado' : $status,
                'currency' => $seed['currency'],
                'fx_rate' => $seed['currency'] === 'USD' ? $this->fx : 1,
                'cost_amount' => $service['cost'] ?? 0,
                'price_amount' => $service['price'] ?? 0,
                'service_kind' => $kind,
                'confirmation_code' => $code,
            ]);
        }
    }

    private function serviceKind(array $service): string
    {
        $name = Str::lower($service['name']);

        return match (true) {
            str_contains($name, 'traslado') || ($service['pickup'] ?? false) => 'traslado',
            isset($service['nights']) || isset($service['rooms']) || isset($service['lodgingLeg']) || str_contains($name, 'hotel') || str_contains($name, 'noche') => 'alojamiento',
            str_contains($name, 'tren') || str_contains($name, 'entrada') || str_contains($name, '→') => 'tren_entrada',
            str_contains($name, 'libre') => 'libre',
            default => 'tour',
        };
    }

    private function seedQuotes(): void
    {
        $byQuote = collect($this->reservations)->filter(fn ($reservation) => $reservation['quote'] !== null)->mapWithKeys(fn ($reservation) => [$reservation['quote'] => $reservation['id']]);

        foreach (KitSeeds::read('quotes') as $seed) {
            $reservation = $byQuote[$seed['id']] ?? null;
            $quoteId = $this->quotes[$seed['id']] = $this->insert('quote_quotes', ['code' => $seed['id']], [
                'client_id' => $this->clients[$seed['clientId']],
                'opportunity_id' => isset($seed['oppId']) ? ($this->opportunities[$seed['oppId']] ?? null) : null,
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

            $this->seedQuoteVersions($quoteId, $seed);
        }
    }

    private function seedQuoteVersions(string $quoteId, array $seed): void
    {
        $products = DB::table('catalog_products')->where('tenant_id', $this->tenant->getKey())->get(['id', 'ref', 'name'])->keyBy('ref');
        $currentId = null;

        foreach ($seed['versions'] ?? [] as $version) {
            $items = collect($version['items'])->filter(fn (array $item) => isset($products[$item['productId']]))->values()->map(fn (array $item) => [
                'product_id' => $products[$item['productId']]->id,
                'product_name' => $products[$item['productId']]->name,
                'service_date' => $this->day($item['date']),
                'qty' => (int) $item['qty'],
                'pax' => (int) $item['pax'],
                'unit_cost' => (float) $item['unitCost'],
                'unit_price' => (float) $item['unitPrice'],
                'segment' => $item['segment'] ?? 'Adulto',
            ]);
            $totals = QuotePricing::totals($items->all(), (float) ($version['discountPct'] ?? 0), (float) ($version['taxPct'] ?? 18));
            $versionId = $this->insert('quote_versions', ['quote_id' => $quoteId, 'version_no' => $version['v']], [
                'status' => $version['status'],
                'issued_on' => $this->day($version['date']),
                'author_id' => $this->user($version['user']),
                'discount_pct' => $version['discountPct'] ?? 0,
                'tax_pct' => $version['taxPct'] ?? 18,
                'markup_pct' => $version['markupPct'] ?? 0,
                'notes' => isset($version['notes']) ? $this->text($version['notes']) : null,
                'snapshot_label' => $version['snapshot'] ?? 'Catálogo vigente',
                'catalog_snapshot' => json_encode($items->map(fn (array $item) => ['product_id' => $item['product_id'], 'name' => $item['product_name']])->all(), JSON_UNESCAPED_UNICODE),
                'policies_snapshot' => '{}',
                'fx_rate' => $seed['currency'] === 'USD' ? $this->fx : 1,
                'currency' => $seed['currency'],
                ...$totals,
            ]);
            DB::table('quote_items')->where('quote_version_id', $versionId)->delete();
            foreach ($items as $index => $item) {
                DB::table('quote_items')->insert([
                    'id' => (string) Str::uuid7(),
                    'tenant_id' => $this->tenant->getKey(),
                    'quote_version_id' => $versionId,
                    'line_no' => $index + 1,
                    'product_id' => $item['product_id'],
                    'product_version' => '1.0',
                    'segment' => $item['segment'],
                    'service_date' => $item['service_date'],
                    'qty' => $item['qty'],
                    'pax' => $item['pax'],
                    'unit_cost' => $item['unit_cost'],
                    'unit_price' => $item['unit_price'],
                    'price_source' => 'manual',
                ]);
            }
            if ((int) $version['v'] === (int) ($seed['currentVersion'] ?? 1)) {
                $currentId = $versionId;
            }
        }

        if ($currentId) {
            DB::table('quote_quotes')->where('id', $quoteId)->update(['current_version_id' => $currentId]);
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
            $created = Carbon::parse($this->date($seed['createdAt']))->utc();
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
