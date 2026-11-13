<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Actions;

use App\Domain\Iam\Models\User;
use App\Domain\Integrations\Support\ChannelWebhooks;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ChannelAccounts
{
    public const PERMISSION = 'admin.settings.manage';

    public const CHANNELS = [
        'whatsapp' => ['label' => 'WhatsApp Business', 'path' => '/api/v1/integrations/whatsapp/webhook', 'key' => 'phone_number_id'],
        'email' => ['label' => 'Correo de atención', 'path' => '/api/v1/integrations/email/inbound', 'key' => 'mailbox'],
    ];

    public const STATUSES = ['activo' => 'Conectado', 'sandbox' => 'Modo de prueba', 'inactivo' => 'Desconectado'];

    private const ENTITY = 'Cuenta de canal';

    private const LABELS = [
        'name' => 'Nombre',
        'phone_number_id' => 'ID del número',
        'mailbox' => 'Buzón',
        'first_response_sla_minutes' => 'Plazo de primera respuesta',
        'status' => 'Estado',
        'webhook_secret' => 'Secreto del webhook',
    ];

    public function __construct(private readonly AuditLogger $audit, private readonly TenantContext $context) {}

    public function overview(): array
    {
        return array_map(fn (string $channel): array => $this->present($channel, $this->row($channel)), array_keys(self::CHANNELS));
    }

    public function save(string $channel, array $data, User $actor): array
    {
        $key = self::CHANNELS[$channel]['key'];
        $existing = $this->row($channel);
        $before = $existing === null ? [] : [
            'name' => (string) $existing->name,
            $key => (string) $existing->{$key},
            'first_response_sla_minutes' => (int) $existing->first_response_sla_minutes,
            'status' => (string) $existing->status,
        ];
        $after = [
            'name' => trim((string) ($data['name'] ?? ($before['name'] ?? self::CHANNELS[$channel]['label']))),
            $key => $this->identifier($channel, (string) ($data[$key] ?? ($before[$key] ?? ''))),
            'first_response_sla_minutes' => (int) ($data['first_response_sla_minutes'] ?? ($before['first_response_sla_minutes'] ?? 240)),
            'status' => (string) ($data['status'] ?? ($before['status'] ?? 'sandbox')),
        ];
        $secret = isset($data['webhook_secret']) && trim((string) $data['webhook_secret']) !== '' ? trim((string) $data['webhook_secret']) : null;
        $changes = array_filter(array_keys($after), fn (string $field): bool => ($before[$field] ?? null) !== $after[$field]);

        if ($secret !== null && $secret !== $this->secret($existing)) {
            $changes[] = 'webhook_secret';
        }

        if ($changes === []) {
            throw ApiException::unprocessable('INB-CH-01', 'No hay cambios que guardar.');
        }

        if ($after[$key] === '') {
            throw ApiException::unprocessable('INB-CH-02', $channel === 'whatsapp' ? 'Escribe el ID del número que te da Meta.' : 'Escribe el buzón que recibe los correos.');
        }

        if ($after['status'] === 'activo' && $secret === null && $this->secret($existing) === '') {
            throw ApiException::unprocessable('INB-CH-03', 'Para conectar el canal necesitas el secreto del webhook.');
        }

        $this->ensureAvailable($channel, $after[$key], $existing?->id);

        $hadSecret = $this->secret($existing) !== '';

        DB::transaction(function () use ($channel, $existing, $after, $before, $secret, $changes, $hadSecret, $actor): void {
            $values = [...$after, 'updated_by' => $actor->getKey(), 'updated_at' => now()];

            if ($secret !== null) {
                $values['webhook_secret_encrypted'] = Crypt::encryptString($secret);
            }

            if ($existing === null) {
                DB::table('collab_channel_accounts')->insert([...$values, 'id' => (string) Str::uuid7(), 'channel' => $channel, 'created_by' => $actor->getKey()]);
            } else {
                DB::table('collab_channel_accounts')->where('id', $existing->id)->update($values);
            }

            foreach ($changes as $field) {
                $old = $field === 'webhook_secret' ? ($hadSecret ? 'configurado' : null) : $this->text($field, $before[$field] ?? null);
                $new = $field === 'webhook_secret' ? 'cambiado' : $this->text($field, $after[$field]);
                $this->audit->log(self::ENTITY, mb_substr(self::CHANNELS[$channel]['label'].' · '.self::LABELS[$field], 0, 80), $existing === null ? 'crear' : 'actualizar', $old, $new, diff: ['canal' => $channel, 'campo' => self::LABELS[$field]]);
            }
        });

        return $this->present($channel, $this->row($channel));
    }

    private function present(string $channel, ?object $row): array
    {
        $meta = self::CHANNELS[$channel];

        return [
            'channel' => $channel,
            'label' => $meta['label'],
            'connected' => $row !== null,
            'name' => $row->name ?? $meta['label'],
            'phone_number_id' => $channel === 'whatsapp' ? ($row->phone_number_id ?? null) : null,
            'mailbox' => $channel === 'email' ? ($row->mailbox ?? null) : null,
            'first_response_sla_minutes' => (int) ($row->first_response_sla_minutes ?? 240),
            'status' => $row->status ?? 'sandbox',
            'status_label' => self::STATUSES[$row->status ?? 'sandbox'],
            'webhook_secret_set' => $this->secret($row) !== '',
            'webhook_url' => rtrim((string) config('app.url'), '/').$meta['path'],
            'signature_header' => ChannelWebhooks::SIGNATURE_HEADER,
            'updated_at' => $row?->updated_at ? (string) $row->updated_at : null,
        ];
    }

    private function row(string $channel): ?object
    {
        return DB::table('collab_channel_accounts')->where('channel', $channel)->orderBy('created_at')->first(['id', 'name', 'phone_number_id', 'mailbox', 'first_response_sla_minutes', 'status', 'webhook_secret_encrypted', 'updated_at']);
    }

    private function secret(?object $row): string
    {
        if ($row === null || empty($row->webhook_secret_encrypted)) {
            return '';
        }

        try {
            return Crypt::decryptString((string) $row->webhook_secret_encrypted);
        } catch (DecryptException) {
            return '';
        }
    }

    private function identifier(string $channel, string $value): string
    {
        $value = trim($value);

        return $channel === 'email' ? Str::lower($value) : $value;
    }

    private function ensureAvailable(string $channel, string $identifier, ?string $accountId): void
    {
        $owner = DB::connection('pgsql_platform')->selectOne(
            'select tenant_id, account_id from app_resolve_channel_account(?, ?, ?)',
            [$channel, $channel === 'whatsapp' ? $identifier : null, $channel === 'email' ? $identifier : null],
        );

        if ($owner !== null && ((string) $owner->tenant_id !== $this->context->idOrFail() || (string) $owner->account_id !== (string) $accountId)) {
            throw ApiException::conflict('INB-CH-04', $channel === 'whatsapp' ? 'Ese número ya está conectado a otra cuenta.' : 'Ese buzón ya está conectado a otra cuenta.');
        }
    }

    private function text(string $field, mixed $value): ?string
    {
        return match (true) {
            $field === 'first_response_sla_minutes' && $value !== null => "{$value} min",
            $field === 'status' && $value !== null => self::STATUSES[$value] ?? (string) $value,
            $value === null || $value === '' => null,
            default => (string) $value,
        };
    }
}
