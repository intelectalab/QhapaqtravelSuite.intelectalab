<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Actions;

use App\Domain\Growth\Shared\GrowthRules;
use App\Domain\Iam\Models\User;
use App\Domain\Inbox\Support\WhatsappAccounts;
use App\Domain\Integrations\Contracts\WhatsappCloud;
use App\Domain\Integrations\Support\ChannelWebhooks;
use App\Domain\Platform\Support\IntegrationSecrets;
use App\Domain\Platform\Support\WhatsappWebhook;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class WhatsappConnection
{
    public const OWN_PATH = '/api/v1/integrations/whatsapp/webhook/';

    private const ENTITY = 'Cuenta de canal';

    private const LABEL = 'WhatsApp Business';

    public function __construct(
        private readonly WhatsappAccounts $accounts,
        private readonly WhatsappWebhook $platform,
        private readonly WhatsappCloud $cloud,
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
        private readonly GrowthRules $rules,
    ) {}

    public function overview(): array
    {
        $account = $this->accounts->account();
        $credentials = $this->accounts->credentials($account);
        $connected = $this->accounts->connected($account) !== null;
        $mode = (string) ($account->connection_mode ?? 'plataforma');

        return [
            'connected' => $connected,
            'mode' => $mode,
            'mode_label' => WhatsappAccounts::MODES[$mode] ?? $mode,
            'status' => $account->status ?? null,
            'display_phone' => $account->display_phone ?? null,
            'phone_number_id' => $account->phone_number_id ?? null,
            'waba_masked' => WhatsappAccounts::mask($this->accounts->waba($account)),
            'connected_at' => $account?->connected_at ? (string) $account->connected_at : null,
            'enabled' => $this->rules->enabled('R-WHATSAPP-OFFICIAL'),
            'platform' => [
                'ready' => $this->platform->ready(),
                'app_id' => $this->platform->appId() ?: null,
                'config_id' => (string) ($this->platform->raw()['config_id'] ?? '') ?: null,
                'api_version' => $this->platform->apiVersion(),
                'simulated' => $this->simulated(),
            ],
            'own_app' => [
                'app_id' => $mode === 'propia' ? ($credentials['app_id'] ?? null) : null,
                'app_secret_set' => $mode === 'propia' && filled($account->webhook_secret_encrypted ?? null),
                'access_token_set' => $mode === 'propia' && filled($credentials['access_token'] ?? null),
                'verify_token' => $mode === 'propia' ? ($credentials['verify_token'] ?? null) : null,
                'webhook_url' => $this->ownUrl(),
                'signature_header' => ChannelWebhooks::SIGNATURE_HEADER,
            ],
        ];
    }

    public function connect(array $data, User $actor): array
    {
        $this->rules->ensure('R-WHATSAPP-OFFICIAL', ChannelAccounts::PERMISSION);

        if (! $this->platform->ready()) {
            throw ApiException::unprocessable('WA-CONNECT-01', 'KipuControl todavía no terminó de configurar su app de Meta. Avísanos y lo dejamos listo.');
        }

        $result = $this->cloud->exchangeSignup((string) $data['code'], $this->platform->appId(), $this->platform->appSecret());

        if (! $result->ok) {
            throw ApiException::unprocessable('WA-CONNECT-02', (string) $result->message);
        }

        $phone = (string) ($data['phone_number_id'] ?? $result->payload['phone_number_id'] ?? '');
        $waba = (string) ($data['waba_id'] ?? $result->payload['waba_id'] ?? '');

        return $this->store([
            'connection_mode' => 'plataforma',
            'phone_number_id' => $phone,
            'display_phone' => $result->payload['display_phone'] ?? null,
            'waba' => $waba,
            'credentials' => ['access_token' => (string) ($result->payload['access_token'] ?? '')],
            'secret' => null,
        ], $actor, 'conectar', 'registro guiado');
    }

    public function saveOwnApp(array $data, User $actor): array
    {
        $this->rules->ensure('R-WHATSAPP-OFFICIAL', ChannelAccounts::PERMISSION);
        $account = $this->accounts->account();
        $own = ($account->connection_mode ?? null) === 'propia';
        $current = $own ? $this->accounts->credentials($account) : [];
        $token = filled($data['access_token'] ?? null) ? trim((string) $data['access_token']) : (string) ($current['access_token'] ?? '');
        $secret = filled($data['app_secret'] ?? null) ? trim((string) $data['app_secret']) : null;

        if ($token === '') {
            throw ApiException::unprocessable('WA-OWN-01', 'Pega el token permanente de tu app de Meta.');
        }

        if ($secret === null && ! ($own && filled($account->webhook_secret_encrypted ?? null))) {
            throw ApiException::unprocessable('WA-OWN-01', 'Pega el secreto de tu app de Meta: con él verificamos la firma de cada aviso.');
        }

        $phone = trim((string) $data['phone_number_id']);
        $result = $this->cloud->verifyNumber($phone, $token);

        if (! $result->ok) {
            throw ApiException::unprocessable('WA-OWN-02', (string) $result->message);
        }

        return $this->store([
            'connection_mode' => 'propia',
            'phone_number_id' => $phone,
            'display_phone' => $result->payload['display_phone'] ?? null,
            'waba' => filled($data['waba_id'] ?? null) ? trim((string) $data['waba_id']) : ($own ? (string) $this->accounts->waba($account) : ''),
            'credentials' => [
                'app_id' => trim((string) $data['app_id']),
                'access_token' => $token,
                'verify_token' => (string) ($current['verify_token'] ?? Str::random(32)),
            ],
            'secret' => $secret,
        ], $actor, $own ? 'actualizar' : 'conectar', 'app de Meta propia');
    }

    public function disconnect(User $actor): array
    {
        $account = $this->accounts->account();

        if ($account === null || ($account->status === 'inactivo' && blank($account->connected_at ?? null))) {
            throw ApiException::conflict('WA-CONNECT-03', 'WhatsApp no está conectado.');
        }

        DB::transaction(function () use ($account, $actor): void {
            DB::table('collab_channel_accounts')->where('id', $account->id)->update([
                'status' => 'inactivo',
                'credentials_encrypted' => null,
                'connected_at' => null,
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);
            $this->audit->log(self::ENTITY, self::LABEL.' · Conexión', 'desconectar', $account->display_phone ?? $account->phone_number_id, 'desconectado');
        });

        return $this->overview();
    }

    private function store(array $values, User $actor, string $action, string $how): array
    {
        $phone = (string) $values['phone_number_id'];

        if (preg_match('/^[0-9]{5,30}$/', $phone) !== 1) {
            throw ApiException::unprocessable('WA-CONNECT-02', 'Meta no devolvió el ID del número. Vuelve a intentarlo.');
        }

        $account = $this->accounts->account();
        $this->ensureAvailable($phone, $account?->id);
        $waba = trim((string) $values['waba']);
        $row = [
            'connection_mode' => $values['connection_mode'],
            'phone_number_id' => $phone,
            'display_phone' => self::e164($values['display_phone']),
            'waba_id_encrypted' => $waba === '' ? null : Crypt::encryptString($waba),
            'waba_id_hash' => $waba === '' ? null : WhatsappAccounts::hash($waba),
            'credentials_encrypted' => IntegrationSecrets::seal($values['credentials']) ?: null,
            'status' => 'activo',
            'connected_at' => now(),
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ];

        if ($values['secret'] !== null) {
            $row['webhook_secret_encrypted'] = Crypt::encryptString((string) $values['secret']);
        }

        DB::transaction(function () use ($account, $row, $actor, $action, $how, $phone): void {
            if ($account === null) {
                DB::table('collab_channel_accounts')->insert([...$row, 'id' => (string) Str::uuid7(), 'channel' => 'whatsapp', 'name' => self::LABEL, 'created_by' => $actor->getKey()]);
            } else {
                DB::table('collab_channel_accounts')->where('id', $account->id)->update($row);
            }

            $this->audit->log(self::ENTITY, self::LABEL.' · Conexión', $action, $account === null ? null : ($account->display_phone ?? $account->phone_number_id), ($row['display_phone'] ?? $phone).' · '.$how);
        });

        return $this->overview();
    }

    public static function e164(mixed $phone): ?string
    {
        $digits = (string) preg_replace('/\D+/', '', (string) $phone);

        return strlen($digits) >= 8 && strlen($digits) <= 15 ? '+'.$digits : null;
    }

    private function ensureAvailable(string $phone, ?string $accountId): void
    {
        $owner = DB::connection('pgsql_platform')->selectOne('select tenant_id, account_id from app_resolve_channel_account(?, ?, ?)', ['whatsapp', $phone, null]);

        if ($owner !== null && ((string) $owner->tenant_id !== $this->context->idOrFail() || (string) $owner->account_id !== (string) $accountId)) {
            throw ApiException::conflict('INB-CH-04', 'Ese número ya está conectado a otra cuenta.');
        }
    }

    private function ownUrl(): string
    {
        return rtrim((string) config('app.url'), '/').self::OWN_PATH.$this->context->tenant()->subdomain;
    }

    private function simulated(): bool
    {
        return (string) config('integrations.drivers.whatsapp', 'fake') === 'fake';
    }
}
