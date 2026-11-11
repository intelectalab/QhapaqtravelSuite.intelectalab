<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Illuminate\Http\Middleware\TrustProxies;
use Illuminate\Http\Request;

final class TrustConfiguredProxies extends TrustProxies
{
    protected function setTrustedProxyIpAddresses(Request $request)
    {
        $request->setTrustedProxies([], $this->getTrustedHeaderNames());

        parent::setTrustedProxyIpAddresses($request);
    }

    protected function proxies(): array|string|null
    {
        $configured = config('app.trusted_proxies');

        if (is_string($configured) && trim($configured) === '*') {
            return '*';
        }

        $list = array_values(array_filter(array_map('trim', explode(',', (string) $configured))));

        return $list === [] ? null : $list;
    }
}
