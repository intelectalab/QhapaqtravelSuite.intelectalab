<?php

declare(strict_types=1);

namespace App\Domain\Platform\Actions;

use App\Domain\Integrations\Contracts\WhatsappCloud;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Support\WhatsappWebhook;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class UpdateWhatsappApp
{
    public const ENTITY = 'App de Meta de WhatsApp';

    private const LABELS = [
        'app_id' => 'ID de la app',
        'app_secret' => 'Secreto de la app',
        'verify_token' => 'Token de verificación',
        'config_id' => 'ID de configuración del registro guiado',
        'api_version' => 'Versión de la API',
    ];

    public function __construct(private readonly WhatsappWebhook $settings, private readonly PlatformSession $session, private readonly WhatsappCloud $cloud) {}

    public function overview(): array
    {
        return $this->settings->app($this->simulated());
    }

    public function update(array $data, PlatformUser $actor): array
    {
        $raw = $this->settings->raw();
        $values = array_filter([
            'app_id' => isset($data['app_id']) ? trim((string) $data['app_id']) : null,
            'config_id' => array_key_exists('config_id', $data) ? trim((string) $data['config_id']) : null,
            'api_version' => isset($data['api_version']) ? trim((string) $data['api_version']) : null,
        ], fn (?string $value): bool => $value !== null);
        $secret = filled($data['app_secret'] ?? null) ? trim((string) $data['app_secret']) : null;
        $token = filled($data['verify_token'] ?? null) ? trim((string) $data['verify_token']) : null;
        $changes = array_keys(array_filter($values, fn (string $value, string $field): bool => $value !== (string) ($field === 'api_version' ? $this->settings->apiVersion() : ($raw[$field] ?? '')), ARRAY_FILTER_USE_BOTH));

        if ($secret !== null && $secret !== $this->settings->appSecret()) {
            $changes[] = 'app_secret';
        }

        if ($token !== null && $token !== $this->settings->verifyToken()) {
            $changes[] = 'verify_token';
        }

        if ($changes === []) {
            throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
        }

        $rotated = in_array('app_secret', $changes, true) && $this->settings->appSecret() !== '';

        DB::connection('pgsql_platform')->transaction(function () use ($values, $secret, $token, $changes, $raw, $rotated, $actor): void {
            $this->settings->storeApp($values, in_array('app_secret', $changes, true) ? $secret : null, in_array('verify_token', $changes, true) ? $token : null, (string) $actor->getKey());

            foreach ($changes as $field) {
                $secretField = in_array($field, ['app_secret', 'verify_token'], true);
                $before = $secretField ? ($field === 'app_secret' ? ($rotated ? 'configurado' : null) : ((string) ($raw['verify_token'] ?? '') !== '' ? 'configurado' : null)) : ((string) ($raw[$field] ?? '') ?: null);
                $after = $secretField ? ($field === 'app_secret' && $rotated ? 'rotado · el anterior vale 24 h' : 'cambiado') : $values[$field];
                $this->session->log(self::ENTITY, self::LABELS[$field], $field === 'app_secret' && $rotated ? 'rotar' : 'actualizar', $before, $after, $actor);
            }
        });

        return $this->overview();
    }

    public function test(PlatformUser $actor): array
    {
        if (! $this->settings->ready()) {
            throw ApiException::unprocessable('WA-APP-01', 'Guarda el ID y el secreto de la app antes de probar.');
        }

        $result = $this->cloud->verifyApp($this->settings->appId(), $this->settings->appSecret(), $this->settings->apiVersion());
        $message = $result->ok ? 'Meta reconoció la app.' : (string) $result->message;

        DB::connection('pgsql_platform')->transaction(function () use ($result, $message, $actor): void {
            $this->settings->recordTest($result->ok, $message, (string) $actor->getKey());
            $this->session->log(self::ENTITY, 'Prueba de conexión', 'probar', null, $result->ok ? 'correcta' : 'fallida · '.$message, $actor);
        });

        return [...$this->overview(), 'test' => ['ok' => $result->ok, 'message' => $message]];
    }

    private function simulated(): bool
    {
        return (string) config('integrations.drivers.whatsapp', 'fake') === 'fake';
    }
}
