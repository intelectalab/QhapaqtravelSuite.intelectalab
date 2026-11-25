<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Payments\Adapters;

use App\Domain\Integrations\Contracts\PaymentConnector;
use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Integrations\Payments\ConnectorCatalog;
use App\Domain\Integrations\Payments\GatewayAccount;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Closure;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

abstract class GatewayAdapter implements PaymentConnector
{
    protected const SESSION_MINUTES = 30;

    protected const UNREACHABLE = 'La pasarela no respondió. Intenta de nuevo en unos minutos.';

    protected const DECLINED = 'La tarjeta fue rechazada. Prueba con otra tarjeta u otro medio de pago.';

    public function __construct(protected readonly GatewayAccount $account) {}

    public function name(): string
    {
        return $this->account->provider;
    }

    public function verifyWebhook(string $rawBody, string $signature): bool
    {
        return false;
    }

    protected function http(): PendingRequest
    {
        return Http::acceptJson()->asJson()->connectTimeout(5)->timeout(25)->withUserAgent('KipuControl');
    }

    protected function call(Closure $request): AdapterResult
    {
        try {
            return $request();
        } catch (ConnectionException) {
            return AdapterResult::transient(self::UNREACHABLE);
        } catch (Throwable $e) {
            report($e);

            return AdapterResult::transient(self::UNREACHABLE);
        }
    }

    protected function session(string $sid, array $embed): AdapterResult
    {
        return AdapterResult::success('sesion', $sid, [
            'expires_at' => now()->addMinutes(self::SESSION_MINUTES)->toIso8601String(),
            'three_ds' => 'si_el_emisor_lo_exige',
            'embed' => ['provider' => $this->name(), 'label' => ConnectorCatalog::label($this->name()), 'mode' => $this->account->mode, ...$embed],
        ]);
    }

    protected function approved(string $txn, ?string $last4, array $extra = []): AdapterResult
    {
        return AdapterResult::success('aprobado', $txn, ['code' => '00', 'masked' => self::masked($last4), 'three_ds' => 'autenticado', ...$extra]);
    }

    protected function declined(string $code, ?string $message = null, ?string $last4 = null): AdapterResult
    {
        return new AdapterResult(false, 'rechazado', null, 'permanente', $message ?? self::DECLINED, ['code' => mb_substr($code === '' ? 'rechazado' : $code, 0, 20), 'masked' => self::masked($last4)]);
    }

    protected function failedCheck(string $message): AdapterResult
    {
        return AdapterResult::permanent($message);
    }

    protected function sessionId(string $prefix): string
    {
        return $prefix.'-'.Str::upper(Str::random(16));
    }

    protected function decodeToken(string $token): array
    {
        $data = json_decode($token, true);

        return is_array($data) ? $data : [];
    }

    public static function cents(string $amount): int
    {
        return BigDecimal::of($amount)->multipliedBy(100)->toScale(0, RoundingMode::HALF_UP)->toInt();
    }

    public static function fromCents(int|string $cents): string
    {
        return (string) BigDecimal::of((string) $cents)->dividedBy(100, 2, RoundingMode::HALF_UP);
    }

    public static function masked(?string $digits): ?string
    {
        $last4 = $digits === null ? '' : substr((string) preg_replace('/\D/', '', $digits), -4);

        return strlen($last4) === 4 ? "•••• {$last4}" : null;
    }

    protected function metadata(array $metadata): array
    {
        return array_filter([
            'tenant_id' => isset($metadata['tenant_id']) ? (string) $metadata['tenant_id'] : null,
            'scope' => isset($metadata['scope']) ? (string) $metadata['scope'] : null,
            'reference' => isset($metadata['reference']) ? (string) $metadata['reference'] : null,
        ], fn ($value) => $value !== null);
    }
}
