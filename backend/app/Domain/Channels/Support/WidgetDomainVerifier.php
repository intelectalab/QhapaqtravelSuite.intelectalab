<?php

declare(strict_types=1);

namespace App\Domain\Channels\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Integrations\Contracts\DnsResolver;
use App\Domain\Shared\Audit\AuditLogger;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class WidgetDomainVerifier
{
    public const RETRY_HOURS = 72;

    public const EVERY_MINUTES = 10;

    public function __construct(private readonly DnsResolver $dns, private readonly AuditLogger $audit) {}

    public function found(string $domain, string $token): bool
    {
        $expected = self::normalize($token);

        foreach ($this->dns->txt($domain) as $value) {
            if (self::normalize((string) $value) === $expected) {
                return true;
            }
        }

        return false;
    }

    public function check(object $row, ?User $actor, string $origin): bool
    {
        if (! $this->found((string) $row->domain, (string) $row->verify_token)) {
            return false;
        }

        $updated = DB::table('channel_widget_domains')->where('id', $row->id)->where('status', 'pendiente')->update([
            'status' => 'verificado',
            'verified_at' => now()->utc(),
            'updated_by' => $actor?->getKey(),
            'updated_at' => now()->utc(),
        ]);

        if ($updated > 0) {
            $this->audit->log('Dominio del widget', (string) $row->domain, 'verificar', 'pendiente', 'verificado', evidence: ['txt' => $row->verify_token, 'origin' => $origin], actor: $actor);
        }

        return $updated > 0;
    }

    public static function checkingUntil(?string $updatedAt): ?Carbon
    {
        if ($updatedAt === null) {
            return null;
        }

        $until = Carbon::parse($updatedAt)->addHours(self::RETRY_HOURS);

        return $until->isFuture() ? $until : null;
    }

    private static function normalize(string $value): string
    {
        return mb_strtolower(trim(str_replace(['"', ' '], '', $value)));
    }
}
