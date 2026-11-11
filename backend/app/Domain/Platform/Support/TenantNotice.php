<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use App\Domain\Shared\Mail\QueuedMail;
use Illuminate\Support\Facades\DB;

final class TenantNotice
{
    public function __construct(private readonly QueuedMail $mail) {}

    public function send(string $tenantId, string $subject, string $body): bool
    {
        $db = DB::connection('pgsql_platform');
        $tenant = $db->table('tenants')->where('id', $tenantId)->first(['commercial_name', 'admin_email']);
        $email = $db->table('subscriptions')->where('tenant_id', $tenantId)->where('status', '<>', 'canceled')->value('billing_email') ?: $tenant?->admin_email;

        if ($tenant === null || ! $email) {
            return false;
        }

        $this->mail->send((string) $email, (string) $tenant->commercial_name, $subject, "Hola, equipo de {$tenant->commercial_name}:\n\n{$body}\n\nKipuControl");

        return true;
    }
}
