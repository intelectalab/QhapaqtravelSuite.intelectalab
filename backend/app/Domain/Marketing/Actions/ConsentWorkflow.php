<?php

declare(strict_types=1);

namespace App\Domain\Marketing\Actions;

use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Iam\Models\User;
use App\Domain\Marketing\Support\CampaignDirectory;
use App\Domain\Marketing\Support\ContactBook;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Concurrency\IfMatch;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Request;
use Illuminate\Support\Str;

final class ConsentWorkflow
{
    public function __construct(
        private readonly CodeSequence $codes,
        private readonly AuditLogger $audit,
        private readonly ContactBook $contacts,
    ) {}

    public function grant(array $data, User $actor): string
    {
        $contact = $this->contacts->all()->first(fn (array $row): bool => $row['type'] === $data['subject_type'] && $row['id'] === $data['subject_id'])
            ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'El contacto no existe o ya no recibe comunicaciones.');
        $channel = $data['channel'];

        if (empty($contact[$channel === 'email' ? 'email' : 'mobile'])) {
            throw ApiException::unprocessable('MKT-BR-06', $channel === 'email' ? 'El contacto no tiene un correo registrado.' : 'El contacto no tiene un celular válido para WhatsApp.');
        }

        return DB::transaction(function () use ($data, $actor, $channel, $contact): string {
            $current = DB::table('mkt_consents')->where(['subject_type' => $data['subject_type'], 'subject_id' => $data['subject_id'], 'channel' => $channel])->lockForUpdate()->first();

            if ($current !== null && $current->status === 'otorgado') {
                throw ApiException::conflict('MKT-BR-11', 'El contacto ya tiene un consentimiento vigente para '.CampaignDirectory::CHANNELS[$channel].'.');
            }

            if ($current !== null && isset($data['lock_version'])) {
                IfMatch::assertMatches((int) $data['lock_version'], (int) $current->lock_version, 'El consentimiento');
            }

            $values = [
                'status' => 'otorgado',
                'granted_at' => now(),
                'source' => $data['source'],
                'evidence' => $data['evidence'],
                'policy_version' => $data['policy_version'],
                'revoked_at' => null,
                'revoke_source' => null,
                'revoke_campaign_id' => null,
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ];

            if ($current === null) {
                $id = (string) Str::uuid7();
                $code = $this->codes->next('mkt_consents', 'CNS-');
                DB::table('mkt_consents')->insert(['id' => $id, 'code' => $code, 'subject_type' => $data['subject_type'], 'subject_id' => $data['subject_id'], 'channel' => $channel, ...$values, 'created_by' => $actor->getKey()]);
            } else {
                [$id, $code] = [$current->id, $current->code];
                DB::table('mkt_consents')->where('id', $id)->update($values);
            }

            $this->event($id, 'otorgado', $data['source'], $data['evidence'], $actor);
            $this->audit->log('Consentimiento', $code, "otorgar_{$channel}", $current->status ?? 'sin registro', "otorgado · {$data['source']} · {$contact['name']}");

            return $code;
        });
    }

    public function revoke(string $code, string $source, ?int $lockVersion, User $actor): void
    {
        DB::transaction(function () use ($code, $source, $lockVersion, $actor): void {
            $consent = DB::table('mkt_consents')->where('code', $code)->lockForUpdate()->first() ?? throw ApiException::notFound('El consentimiento no existe.');

            if ($consent->status === 'revocado') {
                return;
            }

            if ($lockVersion !== null) {
                IfMatch::assertMatches($lockVersion, (int) $consent->lock_version, 'El consentimiento');
            }

            DB::table('mkt_consents')->where('id', $consent->id)->update(['status' => 'revocado', 'revoked_at' => now(), 'revoke_source' => $source, 'revoke_campaign_id' => null, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->event($consent->id, 'revocado', $source, null, $actor);
            $this->audit->log('Consentimiento', $consent->code, "baja_{$consent->channel}", 'otorgado', "revocado · {$source}");
        });
    }

    private function event(string $consentId, string $event, string $source, ?string $evidence, User $actor): void
    {
        DB::table('mkt_consent_events')->insert([
            'id' => (string) Str::uuid7(),
            'consent_id' => $consentId,
            'event' => $event,
            'source' => $source,
            'evidence' => $evidence,
            'actor_id' => $actor->getKey(),
            'occurred_at' => now(),
            'ip' => Request::ip(),
        ]);
    }
}
