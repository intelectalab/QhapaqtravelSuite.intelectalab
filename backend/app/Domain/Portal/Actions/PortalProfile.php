<?php

declare(strict_types=1);

namespace App\Domain\Portal\Actions;

use App\Domain\Crm\Support\ClientDocument;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Portal\Support\PortalAccount;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class PortalProfile
{
    public const LOCALES = ['es', 'en', 'de', 'fr', 'pt'];

    public function __construct(private readonly CodeSequence $sequence, private readonly AuditLogger $audit) {}

    public function update(PortalAccount $account, array $data): void
    {
        if ($account->isPassenger()) {
            throw ApiException::forbidden('PORTAL_READ_ONLY', 'Pide a quien hizo la reserva que actualice estos datos.');
        }

        $client = $account->client;
        $email = array_key_exists('email', $data) ? (trim((string) $data['email']) ?: null) : $client->email;
        $phone = array_key_exists('phone', $data) ? (trim((string) $data['phone']) ?: null) : $client->phone;
        $phoneNorm = ClientDocument::phoneNorm($phone);

        $taken = DB::table('crm_clients')->whereNull('deleted_at')->where('id', '<>', $client->id)
            ->where(function ($query) use ($email, $phoneNorm): void {
                $query->whereRaw('false');
                if ($email) {
                    $query->orWhere('email_norm', mb_strtolower($email));
                }
                if ($phoneNorm) {
                    $query->orWhere('phone_norm', $phoneNorm);
                }
            })->exists();

        if ($taken) {
            throw ApiException::conflict('CRM-BR-17', 'Ese correo o teléfono ya figura en otra cuenta. Escríbenos y lo revisamos.');
        }

        $values = ['email' => $email, 'phone' => $phone, 'phone_norm' => $phoneNorm, 'city' => array_key_exists('city', $data) ? (trim((string) $data['city']) ?: null) : $client->city, 'country' => $data['country'] ?? $client->country];
        $before = collect((array) $client)->only(array_keys($values))->except('phone_norm')->all();

        DB::transaction(function () use ($account, $client, $values, $before, $data): void {
            DB::table('crm_clients')->where('id', $client->id)->update([...$values, 'updated_by' => $account->user->getKey(), 'updated_at' => now()]);
            DB::table('iam_users')->where('id', $account->user->getKey())->update(['locale' => $data['locale'], 'updated_at' => now()]);
            $after = collect($values)->except('phone_norm')->all();
            $this->audit->log('Cliente', $client->code, 'actualizar_portal', null, null, ['before' => $before, 'after' => $after, 'locale' => $data['locale']]);
        });
    }

    public function consent(PortalAccount $account, string $channel, bool $granted, ?string $ip): void
    {
        $client = $account->client;
        $current = DB::table('mkt_consents')->where('subject_type', 'client')->where('subject_id', $client->id)->where('channel', $channel)->first(['id', 'code', 'status', 'policy_version']);
        $status = $granted ? 'otorgado' : 'revocado';

        if ($current?->status === $status || ($current === null && ! $granted)) {
            return;
        }

        DB::transaction(function () use ($account, $client, $channel, $granted, $ip, $current, $status): void {
            $now = now();
            $evidence = "Portal del cliente · {$account->user->email}";
            $policy = $current->policy_version ?? DB::table('mkt_consents')->orderByDesc('created_at')->value('policy_version') ?? 'vigente';

            if ($current === null) {
                $id = (string) DB::table('mkt_consents')->insertGetId([
                    'code' => $this->sequence->next('mkt_consents', 'CNS-'),
                    'subject_type' => 'client',
                    'subject_id' => $client->id,
                    'channel' => $channel,
                    'status' => 'otorgado',
                    'granted_at' => $now,
                    'source' => 'Portal del cliente',
                    'evidence' => $evidence,
                    'policy_version' => $policy,
                    'created_by' => $account->user->getKey(),
                    'updated_by' => $account->user->getKey(),
                ], 'id');
            } else {
                $id = (string) $current->id;
                DB::table('mkt_consents')->where('id', $id)->update($granted
                    ? ['status' => 'otorgado', 'granted_at' => $now, 'revoked_at' => null, 'revoke_source' => null, 'source' => 'Portal del cliente', 'evidence' => $evidence, 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $account->user->getKey(), 'updated_at' => $now]
                    : ['status' => 'revocado', 'revoked_at' => $now, 'revoke_source' => 'Portal del cliente', 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $account->user->getKey(), 'updated_at' => $now]);
            }

            DB::table('mkt_consent_events')->insert(['consent_id' => $id, 'event' => $status, 'source' => 'Portal del cliente', 'evidence' => $evidence, 'actor_id' => $account->user->getKey(), 'occurred_at' => $now, 'ip' => $ip]);
            $this->audit->log('Consentimiento', $client->code, $granted ? 'otorgar_consentimiento' : 'revocar_consentimiento', $current?->status, "{$channel} · {$status}");
        });
    }
}
