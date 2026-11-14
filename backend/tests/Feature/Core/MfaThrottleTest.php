<?php

use App\Domain\Iam\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

function mfaLimitKey(?object $user, string $ip = '10.0.0.7'): string
{
    $request = Request::create('/api/v1/auth/mfa/verify', 'POST', server: ['REMOTE_ADDR' => $ip]);
    $request->setUserResolver(fn () => $user);

    return RateLimiter::limiter('mfa')($request)->key;
}

it('el límite del código MFA cuenta por usuario, así varias personas de la misma oficina pueden verificar a la vez', function () {
    $first = (new User)->forceFill(['id' => '0190a000-0000-7000-8000-000000000001']);
    $second = (new User)->forceFill(['id' => '0190a000-0000-7000-8000-000000000002']);

    expect(mfaLimitKey($first))->not->toBe(mfaLimitKey($second))
        ->and(mfaLimitKey($first, '10.0.0.7'))->toBe(mfaLimitKey($first, '10.0.0.99'))
        ->and(RateLimiter::limiter('mfa')(tap(Request::create('/'), fn ($r) => $r->setUserResolver(fn () => $first)))->maxAttempts)->toBe(5);
});

it('sin sesión pendiente el límite del código MFA cae a la IP', function () {
    expect(mfaLimitKey(null, '10.0.0.7'))->toBe('mfa|ip:10.0.0.7');
});
