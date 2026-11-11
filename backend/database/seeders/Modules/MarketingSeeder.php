<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Marketing\Support\AutomationDirectory;
use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class MarketingSeeder
{
    use SeedsTenant;

    private const SUBJECT_TABLES = ['client' => 'crm_clients', 'lead' => 'crm_leads', 'subscriber' => 'mkt_contacts_subscribers'];

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        foreach (KitSeeds::read('subscribers') as $seed) {
            $digits = preg_replace('/\D/', '', (string) ($seed['phone'] ?? ''));
            $this->upsert('mkt_contacts_subscribers', ['code' => $seed['id']], [
                'full_name' => $seed['name'],
                'email' => Str::lower($seed['email']),
                'phone' => $seed['phone'] ?? null,
                'phone_e164' => $digits === '' ? null : (strlen($digits) === 9 ? "+51{$digits}" : "+{$digits}"),
                'country' => $seed['country'] ?? null,
                'interest_destination' => $seed['interest'] ?? null,
                'source' => $seed['source'],
                'double_opt_in_at' => $this->moment($seed['createdAt']),
                'created_at' => $this->moment($seed['createdAt']),
                'updated_at' => $this->moment($seed['createdAt']),
            ]);
        }

        $templates = [];
        foreach (KitSeeds::read('mktTemplates') as $seed) {
            $templates[$seed['id']] = $this->upsert('mkt_templates', ['code' => $seed['id']], [
                'name' => $seed['name'],
                'channel' => $seed['channel'],
                'category' => $seed['category'],
                'status' => $seed['status'],
                'provider_template_id' => $seed['channel'] === 'whatsapp' ? 'wa_tpl_'.Str::lower($seed['id']) : null,
                'language' => 'es',
                'subject' => $seed['subject'] ?? null,
                'body' => $seed['body'],
                'reviewed_at' => $seed['status'] === 'aprobada' ? $this->moment($seed['updatedAt'] ?? null) : null,
                'created_by' => $this->userId($seed['updatedBy'] ?? null),
                'created_at' => $this->moment($seed['updatedAt'] ?? null) ?? now(),
                'updated_at' => $this->moment($seed['updatedAt'] ?? null) ?? now(),
            ]);
        }

        $segments = [];
        foreach (KitSeeds::read('segments') as $seed) {
            $segments[$seed['id']] = $this->upsert('mkt_segments', ['code' => $seed['id']], [
                'name' => $seed['name'],
                'description' => $seed['desc'] ?? null,
                'match' => $seed['match'],
                'rules' => json_encode($seed['rules'], JSON_UNESCAPED_UNICODE),
                'owner_id' => $this->userId($seed['owner']),
                'created_by' => $this->userId($seed['owner']),
                'created_at' => $this->moment($seed['createdAt']),
                'updated_at' => $this->moment($seed['updatedAt'] ?? $seed['createdAt']),
            ]);
        }

        $campaigns = [];
        foreach (KitSeeds::read('campaigns') as $seed) {
            $campaigns[$seed['id']] = $this->seedCampaign($seed, $segments, $templates);
        }

        foreach (KitSeeds::read('consents') as $seed) {
            $this->seedConsent($seed, $campaigns);
        }

        foreach (KitSeeds::read('automations') as $seed) {
            $this->seedAutomation($seed, $templates);
        }
    }

    private function seedAutomation(array $seed, array $templates): void
    {
        $id = $this->upsert('mkt_automations', ['code' => $seed['id']], [
            'key' => $seed['key'],
            'name' => $seed['name'],
            'trigger_desc' => $seed['trigger'],
            'delay_desc' => $seed['delay'],
            'delay_minutes' => AutomationDirectory::DELAY_MINUTES[$seed['key']] ?? null,
            'schedule_cron' => AutomationDirectory::SCHEDULES[$seed['key']] ?? null,
            'channel' => $seed['channel'],
            'template_id' => $templates[$seed['templateId']],
            'purpose' => $seed['purpose'],
            'status' => $seed['status'],
            'sent_total' => $seed['stats']['sent'] ?? 0,
            'suppressed_total' => $seed['stats']['suppressed'] ?? 0,
            'conversions_total' => $seed['stats']['conv'] ?? 0,
            'created_by' => $this->userId($seed['updatedBy'] ?? null),
            'created_at' => $this->moment($seed['updatedAt'] ?? null) ?? now(),
            'updated_at' => $this->moment($seed['updatedAt'] ?? null) ?? now(),
        ]);

        foreach ($seed['done'] ?? [] as $key) {
            [$type, $subjectId] = $this->subject($key);
            if ($subjectId === null || DB::table('mkt_automation_enrollments')->where(['automation_id' => $id, 'subject_type' => $type, 'subject_id' => $subjectId])->exists()) {
                continue;
            }
            DB::table('mkt_automation_enrollments')->insert([
                'id' => (string) Str::uuid7(),
                'tenant_id' => $this->tenant->getKey(),
                'automation_id' => $id,
                'subject_type' => $type,
                'subject_id' => $subjectId,
                'ref_type' => $type,
                'ref_id' => $subjectId,
                'status' => 'enviado',
                'processed_at' => $this->moment($seed['updatedAt'] ?? null) ?? now(),
            ]);
        }
    }

    private function subject(string $key): array
    {
        [$type, $code] = explode(':', $key, 2);

        return [$type, isset(self::SUBJECT_TABLES[$type]) ? $this->idByCode(self::SUBJECT_TABLES[$type], $code) : null];
    }

    private function seedCampaign(array $seed, array $segments, array $templates): string
    {
        $sentAt = $this->moment($seed['sentAt'] ?? null);
        $audience = $seed['audience'] ?? null;

        $id = $this->upsert('mkt_campaigns', ['code' => $seed['id']], [
            'name' => $seed['name'],
            'channel' => $seed['channel'],
            'segment_id' => $segments[$seed['segmentId']],
            'template_id' => $templates[$seed['templateId']],
            'subject' => ($seed['subject'] ?? '') !== '' ? $seed['subject'] : null,
            'body' => $seed['body'],
            'promo_code' => $seed['promo']['code'] ?? null,
            'utm' => $seed['utm'],
            'status' => $seed['status'],
            'scheduled_at' => $this->moment($seed['scheduledAt'] ?? null),
            'sent_at' => $sentAt,
            'completed_at' => $seed['status'] === 'enviada' ? $sentAt : null,
            'audience_snapshot' => $audience ? json_encode([...$audience, 'at' => $this->moment($audience['at'] ?? null)]) : null,
            'owner_id' => $this->userId($seed['owner']),
            'created_by' => $this->userId($seed['owner']),
            'created_at' => $this->moment($seed['createdAt']),
            'updated_at' => $this->moment($seed['sentAt'] ?? $seed['createdAt']),
        ]);

        if ($sentAt === null || DB::table('mkt_campaign_recipients')->where('campaign_id', $id)->exists()) {
            return $id;
        }

        $base = Carbon::parse($sentAt);
        foreach ($seed['recipients'] ?? [] as $index => $recipient) {
            [$type, $subjectId] = $this->subject($recipient['k']);
            if ($subjectId === null) {
                continue;
            }
            $delivered = (bool) $recipient['d'];
            DB::table('mkt_campaign_recipients')->insert([
                'id' => (string) Str::uuid7(),
                'tenant_id' => $this->tenant->getKey(),
                'campaign_id' => $id,
                'subject_type' => $type,
                'subject_id' => $subjectId,
                'address' => $recipient['to'],
                'provider_message_id' => Str::lower($seed['id']).'-'.str_pad((string) ($index + 1), 3, '0', STR_PAD_LEFT),
                'status' => $delivered ? 'entregado' : ($seed['channel'] === 'email' ? 'rebotado' : 'fallido'),
                'delivered_at' => $delivered ? $base->copy()->addMinutes(2 + $index)->toIso8601String() : null,
                'opened_at' => $recipient['o'] ? $base->copy()->addHours(3 + $index)->toIso8601String() : null,
                'clicked_at' => $recipient['c'] ? $base->copy()->addHours(4 + $index)->toIso8601String() : null,
                'replied_at' => $recipient['r'] ? $base->copy()->addHours(6 + $index)->toIso8601String() : null,
                'unsubscribed_at' => $recipient['u'] ? $base->copy()->addHours(8 + $index)->toIso8601String() : null,
                'error' => $delivered ? null : 'El destinatario no recibió el mensaje.',
                'created_at' => $sentAt,
                'updated_at' => $sentAt,
            ]);
        }

        return $id;
    }

    private function seedConsent(array $seed, array $campaigns): void
    {
        [$type, $subjectId] = $this->subject($seed['key']);
        if ($subjectId === null) {
            return;
        }
        $revoked = $seed['status'] === 'revocado';

        $id = $this->upsert('mkt_consents', ['code' => $seed['id']], [
            'subject_type' => $type,
            'subject_id' => $subjectId,
            'channel' => $seed['channel'],
            'status' => $seed['status'],
            'granted_at' => $this->moment($seed['grantedAt']),
            'source' => $seed['source'],
            'evidence' => $seed['evidence'],
            'policy_version' => $seed['policyVersion'],
            'revoked_at' => $revoked ? $this->moment($seed['revokedAt']) : null,
            'revoke_source' => $revoked ? ($seed['revokeSource'] ?: null) : null,
            'revoke_campaign_id' => $revoked && $seed['revokeCampaign'] ? ($campaigns[$seed['revokeCampaign']] ?? null) : null,
            'created_at' => $this->moment($seed['grantedAt']),
            'updated_at' => $this->moment($seed['revokedAt'] ?? $seed['grantedAt']),
        ]);

        if (DB::table('mkt_consent_events')->where('consent_id', $id)->exists()) {
            return;
        }

        foreach ($seed['history'] ?? [] as $entry) {
            $isRevoke = str_starts_with((string) $entry['m'], 'Baja');
            DB::table('mkt_consent_events')->insert([
                'id' => (string) Str::uuid7(),
                'tenant_id' => $this->tenant->getKey(),
                'consent_id' => $id,
                'event' => $isRevoke ? 'revocado' : 'otorgado',
                'source' => $isRevoke ? ($seed['revokeSource'] ?: 'Baja') : $seed['source'],
                'evidence' => $isRevoke ? null : $seed['evidence'],
                'actor_id' => str_starts_with((string) $entry['u'], 'U') ? $this->userId($entry['u']) : null,
                'occurred_at' => $this->moment($entry['ts']),
            ]);
        }
    }
}
