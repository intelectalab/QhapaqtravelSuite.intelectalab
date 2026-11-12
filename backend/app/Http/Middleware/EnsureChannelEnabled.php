<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domain\Admin\Support\SettingsCatalog;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

final class EnsureChannelEnabled
{
    private const PREFIXES = [
        'mobile.operator.' => 'app_operador',
        'mobile.passenger.' => 'app_pasajero',
        'portal.passenger.' => 'portal_pasajero',
        'portal.' => 'portal_cliente',
        'b2b.' => 'b2b',
        'public.site.shop' => 'ecommerce',
        'public.site.cart' => 'ecommerce',
        'public.site.payments' => 'ecommerce',
        'public.site.' => 'web',
    ];

    public function __construct(private readonly TenantContext $context) {}

    public function handle(Request $request, Closure $next): Response
    {
        $channel = self::channelFor($request->route()?->getName());

        if ($channel !== null && $this->context->has() && self::disabled($channel)) {
            throw ApiException::forbidden('CHANNEL_DISABLED', SettingsCatalog::CHANNELS[$channel]['label'].' está desactivado por la agencia.');
        }

        return $next($request);
    }

    public static function channelFor(?string $name): ?string
    {
        if ($name === null) {
            return null;
        }

        foreach (self::PREFIXES as $prefix => $channel) {
            if (str_starts_with($name, $prefix)) {
                return $channel;
            }
        }

        return null;
    }

    public static function disabled(string $channel): bool
    {
        $values = DB::table('sys_settings')->where('section', 'channels')->value('values');
        $channels = is_string($values) ? (array) json_decode($values, true) : [];

        return array_key_exists($channel, $channels) && $channels[$channel] === false;
    }
}
