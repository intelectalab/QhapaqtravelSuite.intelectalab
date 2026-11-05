<?php

declare(strict_types=1);

namespace App\Domain\Iam\Actions;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use Illuminate\Support\Facades\Request;

final class RecordLogin
{
    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function __invoke(User $user, string $result): void
    {
        $user->forceFill(['last_login_at' => now(), 'last_login_ip' => Request::ip()])->save();
        $this->audit->log('Sesión', (string) $user->code, 'login', after: $result, actor: $user);
    }
}
