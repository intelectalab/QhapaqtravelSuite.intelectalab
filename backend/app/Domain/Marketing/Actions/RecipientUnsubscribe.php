<?php

declare(strict_types=1);

namespace App\Domain\Marketing\Actions;

use App\Domain\Iam\Models\User;
use App\Domain\Marketing\Support\CampaignDirectory;
use App\Domain\Marketing\Support\ContactBook;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Site\Actions\NewsletterLifecycle;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

final class RecipientUnsubscribe
{
    public function __construct(
        private readonly ConsentWorkflow $consents,
        private readonly AuditLogger $audit,
        private readonly ContactBook $contacts,
        private readonly TenantContext $context,
    ) {}

    public function manual(string $code, string $recipientId, User $actor): array
    {
        $campaign = DB::table('mkt_campaigns')->where('code', $code)->first(['id', 'code', 'channel']) ?? throw ApiException::notFound('La campaña no existe.');
        $recipient = Str::isUuid($recipientId) ? DB::table('mkt_campaign_recipients')->where('campaign_id', $campaign->id)->where('id', $recipientId)->first() : null;

        if (! $recipient instanceof stdClass) {
            throw ApiException::notFound('El destinatario no pertenece a esta campaña.');
        }

        $source = "Baja manual desde la campaña {$campaign->code}";

        DB::transaction(function () use ($campaign, $recipient, $source, $actor): void {
            $consent = DB::table('mkt_consents')->where('subject_type', $recipient->subject_type)->where('subject_id', $recipient->subject_id)->where('channel', $campaign->channel)->first(['code', 'status']);

            if ($consent !== null && $consent->status === 'otorgado') {
                $this->consents->revoke((string) $consent->code, $source, null, $actor);
                DB::table('mkt_consents')->where('code', $consent->code)->update(['revoke_campaign_id' => $campaign->id]);
            }

            if ($recipient->unsubscribed_at === null) {
                DB::table('mkt_campaign_recipients')->where('id', $recipient->id)->update(['unsubscribed_at' => now(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
                $this->audit->log('Campaña', (string) $campaign->code, 'baja_destinatario', null, (string) $recipient->address);
            }
        });

        return $this->present(DB::table('mkt_campaign_recipients')->where('id', $recipient->id)->first());
    }

    public function present(object $row): array
    {
        $contact = $this->contacts->all()->first(fn (array $item): bool => $item['type'] === $row->subject_type && $item['id'] === $row->subject_id);

        return [
            'id' => $row->id,
            'subject_type' => $row->subject_type,
            'subject_id' => $row->subject_id,
            'name' => $contact['name'] ?? $row->address,
            'address' => $row->address,
            'status' => $row->status,
            'status_label' => CampaignDirectory::RECIPIENT_STATUSES[$row->status] ?? $row->status,
            'delivered_at' => $row->delivered_at,
            'opened_at' => $row->opened_at,
            'clicked_at' => $row->clicked_at,
            'replied_at' => $row->replied_at,
            'unsubscribed_at' => $row->unsubscribed_at,
            'error' => $row->error,
        ];
    }

    public function describe(string $token): array
    {
        $agency = (string) $this->context->tenant()->commercial_name;

        if (preg_match('/^c([0-9a-f-]{36})\./', $token, $match) === 1) {
            $recipient = DB::table('mkt_campaign_recipients as r')->join('mkt_campaigns as c', 'c.id', '=', 'r.campaign_id')->where('r.id', $match[1])
                ->first(['r.subject_type', 'r.subject_id', 'r.address', 'r.unsubscribed_at', 'c.channel']);

            if (! $recipient instanceof stdClass || ! hash_equals(NewsletterLifecycle::campaignToken($match[1]), $token)) {
                throw ApiException::notFound('El enlace no es válido.');
            }

            $revoked = DB::table('mkt_consents')->where('subject_type', $recipient->subject_type)->where('subject_id', $recipient->subject_id)->where('channel', 'email')->value('status') === 'revocado';

            return ['agency' => $agency, 'email' => $this->mask((string) $recipient->address), 'kind' => 'campaign', 'status' => $revoked || $recipient->unsubscribed_at !== null ? 'baja' : 'suscrito'];
        }

        $code = Str::before($token, '.');
        $subscriber = DB::table('mkt_contacts_subscribers')->where('code', $code)->whereNull('deleted_at')->first(['id', 'code', 'email']);

        if (! $subscriber instanceof stdClass || ! hash_equals(NewsletterLifecycle::token((string) $subscriber->code, (string) $subscriber->email), $token)) {
            throw ApiException::notFound('El enlace no es válido.');
        }

        $status = DB::table('mkt_consents')->where('subject_type', 'subscriber')->where('subject_id', $subscriber->id)->where('channel', 'email')->value('status');

        return ['agency' => $agency, 'email' => $this->mask((string) $subscriber->email), 'kind' => 'newsletter', 'status' => $status === 'otorgado' ? 'suscrito' : 'baja'];
    }

    private function mask(string $email): string
    {
        [$user, $domain] = array_pad(explode('@', $email, 2), 2, '');

        return mb_substr($user, 0, 2).str_repeat('•', max(3, mb_strlen($user) - 2)).($domain !== '' ? '@'.$domain : '');
    }
}
