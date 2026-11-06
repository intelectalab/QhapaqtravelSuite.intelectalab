<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CrmAfterSalesSeeder
{
    use SeedsTenant;

    public const SURVEY_CHANNELS = ['llamada' => 'Llamada', 'whatsapp' => 'WhatsApp', 'email' => 'Email', 'encuesta_web' => 'Encuesta web', 'portal_del_cliente' => 'Portal del cliente'];

    public const CASE_TYPES = ['reclamo' => 'Reclamo', 'queja' => 'Queja', 'sugerencia' => 'Sugerencia', 'felicitacion' => 'Felicitación'];

    private const BOOK_CHANNELS = ['Portal del pasajero' => 'passenger_portal', 'Portal del cliente' => 'customer_portal', 'Sitio web' => 'web', 'Presencial' => 'in_person'];

    private const BOOK_STATUS = ['recibido' => 'received', 'en_evaluacion' => 'in_review', 'respondido' => 'answered', 'cerrado' => 'closed'];

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        $this->seedCatalog('survey_channel', self::SURVEY_CHANNELS);
        $this->seedCatalog('case_type', self::CASE_TYPES);

        $settings = KitSeeds::read('claimBook');
        $this->upsert('crm_claim_book_settings', [], [
            'response_days' => $settings['responseDays'],
            'alert_days' => $settings['alertDays'],
            'retention_years' => $settings['retentionYears'],
        ]);

        foreach ($settings['holidays'] ?? [] as $date) {
            $this->upsert('sys_holidays', ['date' => $date], ['name' => 'Feriado nacional']);
        }

        $surveys = [];
        foreach (KitSeeds::read('surveys') as $seed) {
            $surveys[$seed['id']] = $this->upsert('crm_surveys', ['code' => $seed['id']], [
                'client_id' => $this->idByCode('crm_clients', $seed['clientId']),
                'reservation_id' => $this->idByCode('booking_reservations', $seed['resId'] ?? null),
                'score' => $seed['score'],
                'comment' => $seed['comment'] ?? null,
                'channel_code' => Str::slug($seed['channel'], '_'),
                'responded_at' => $this->moment($seed['date']),
                'recorded_by' => $this->userId($seed['by']),
                'created_by' => $this->userId($seed['by']),
                'created_at' => $this->moment($seed['date']),
                'updated_at' => $this->moment($seed['date']),
            ]);
        }

        foreach (KitSeeds::read('claims') as $seed) {
            $this->seedCase($seed, $surveys);
        }
    }

    private function seedCatalog(string $kind, array $items): void
    {
        $order = 0;
        foreach ($items as $code => $label) {
            $this->upsert('crm_catalog_items', ['kind' => $kind, 'code' => $code], ['label' => $label, 'requires_detail' => false, 'sort_order' => ++$order, 'is_active' => true]);
        }
    }

    private function seedCase(array $seed, array $surveys): void
    {
        $book = (bool) ($seed['book'] ?? false);
        $response = $seed['response'] ?? null;
        $status = $seed['status'];
        $resolution = trim((string) ($seed['resolution'] ?? '')) ?: ($response['text'] ?? $seed['closeNote'] ?? null);
        $owner = $this->userId($seed['owner']);
        $submitted = $seed['submittedBy'] ?? null;
        $closedAt = $this->moment($seed['closedAt'] ?? null);

        $id = $this->upsert('crm_cases', ['code' => $seed['id']], [
            'client_id' => $this->idByCode('crm_clients', $seed['clientId'] ?? null),
            'reservation_id' => $this->idByCode('booking_reservations', $seed['resId'] ?? null),
            'survey_id' => $seed['surveyId'] ? ($surveys[$seed['surveyId']] ?? null) : null,
            'origin' => $seed['surveyId'] ? 'nps_auto' : 'manual',
            'type_code' => Str::slug($seed['type'], '_'),
            'priority' => $seed['priority'],
            'subject' => mb_substr($seed['subject'], 0, 200),
            'description' => $seed['desc'],
            'status' => $status === 'resuelta' && $resolution === null ? 'en_proceso' : $status,
            'owner_id' => $owner,
            'resolution' => in_array($status, ['resuelta', 'cerrada'], true) ? $resolution : null,
            'resolved_at' => in_array($status, ['resuelta', 'cerrada'], true) ? ($this->moment($response['at'] ?? null) ?? $closedAt) : null,
            'closed_at' => $status === 'cerrada' ? $closedAt : null,
            'is_book' => $book,
            'book_number' => $book ? $seed['bookNo'] : null,
            'sede_id' => $book ? $this->idByCode('iam_sedes', $seed['sede']) : null,
            'channel' => $book ? (self::BOOK_CHANNELS[$seed['channel']] ?? 'web') : null,
            'book_status' => $book ? (self::BOOK_STATUS[$seed['bookStatus']] ?? 'received') : null,
            'consumer' => $book ? json_encode($seed['consumer'], JSON_UNESCAPED_UNICODE) : null,
            'good' => $book ? json_encode($seed['good'], JSON_UNESCAPED_UNICODE) : null,
            'detail' => $book ? $seed['desc'] : null,
            'request' => $book ? ($seed['request'] ?? null) : null,
            'received_at' => $book ? $this->moment($seed['createdAt']) : null,
            'due_date' => $book ? $this->day($seed['dueDate']) : null,
            'response_days' => $book ? ($seed['responseDays'] ?? 15) : null,
            'response' => $response ? json_encode([
                'decision' => $response['decision'] ?? null,
                'text' => $response['text'] ?? null,
                'actions' => $response['actions'] ?? null,
                'answered_at' => $this->moment($response['at'] ?? null),
                'answered_by' => $this->userId($response['by'] ?? null),
                'sent_at' => $this->moment($response['sentAt'] ?? null),
                'sent_to' => $response['sentTo'] ?? null,
            ], JSON_UNESCAPED_UNICODE) : null,
            'close_note' => $seed['closeNote'] ?? null,
            'ack_sent_at' => $this->moment($seed['ackSentAt'] ?? null),
            'submitted_by' => $submitted && str_starts_with($submitted, 'U') ? $this->userId($submitted) : null,
            'created_by' => $owner,
            'created_at' => $this->moment($seed['createdAt']),
            'updated_at' => $this->moment($seed['createdAt']),
        ]);

        if (DB::table('crm_case_events')->where('case_id', $id)->exists()) {
            return;
        }

        foreach ($seed['log'] ?? [] as $index => $entry) {
            $user = $entry['u'] ?? null;
            DB::table('crm_case_events')->insert([
                'id' => (string) Str::uuid7(),
                'tenant_id' => $this->tenant->getKey(),
                'case_id' => $id,
                'event' => $index === 0 ? 'registro' : 'seguimiento',
                'message' => $entry['m'],
                'user_id' => $user && str_starts_with($user, 'U') ? $this->userId($user) : null,
                'created_at' => $this->moment($entry['ts']),
            ]);
        }
    }
}
