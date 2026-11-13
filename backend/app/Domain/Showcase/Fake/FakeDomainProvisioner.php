<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Fake;

use App\Domain\Showcase\Contracts\DomainProvisioner;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

final class FakeDomainProvisioner implements DomainProvisioner
{
    public function verify(string $host, string $token): array
    {
        if (Str::endsWith($host, ['.invalid', '.test']) || Str::startsWith($host, 'sin-dns.')) {
            return ['ok' => false, 'error' => "No encontramos el registro TXT kipu-verify={$token} ni el CNAME a sites.kipucontrol.com para {$host}."];
        }

        return ['ok' => true, 'error' => null];
    }

    public function issueCertificate(string $host): array
    {
        return ['ok' => true, 'expires_at' => Carbon::now()->addDays(90)->toIso8601String(), 'error' => null];
    }
}
