<?php

declare(strict_types=1);

namespace App\Domain\Tracking\Jobs;

use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Shared\Tenancy\TenantDatabase;
use App\Domain\Tracking\Contracts\TagVerifier;
use App\Domain\Tracking\Support\TagScope;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;

final class VerifyTrackingTag implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    public function __construct(public readonly string $scope, public readonly string $code, public readonly ?string $tenantId)
    {
        $this->onQueue('integrations');
    }

    public function handle(TagVerifier $verifier, TenantContext $context, TenantDatabase $database): void
    {
        if ($this->tenantId === null || $context->id() === $this->tenantId) {
            $this->run($verifier);

            return;
        }

        $database->run($this->tenantId, fn () => $this->run($verifier));
    }

    private function run(TagVerifier $verifier): void
    {
        $scope = $this->scope === 'platform' ? TagScope::platform() : TagScope::tenant();
        $tag = $scope->db()->table($scope->tags)->where('code', $this->code)->whereNull('deleted_at')->first();

        if ($tag === null) {
            return;
        }

        $result = $verifier->verify($tag, $this->url($scope, $tag));
        $scope->db()->table($scope->tags)->where('id', $tag->id)->update([
            'verified_at' => now(),
            'verify_result' => $result->ok ? 'ok' : 'fallo',
            'verify_note' => mb_substr((string) ($result->ok ? ($result->payload['note'] ?? 'Carga correcta.') : $result->message), 0, 300),
        ]);
    }

    private function url(TagScope $scope, object $tag): string
    {
        $rules = (array) json_decode((string) $tag->page_rules, true);
        $path = collect((array) ($rules['include'] ?? ['/']))->map(fn ($item) => rtrim(str_replace('*', '', (string) $item), '/'))->first() ?: '/';

        if ($scope->isPlatform()) {
            return 'https://rutaslibres.pe'.($tag->site === 'blog' ? '/blog' : '').($path === '/' ? '' : $path);
        }

        $tenant = DB::connection('pgsql_platform')->table('tenants')->where('id', $this->tenantId)->first(['subdomain', 'custom_domain']);
        $host = ($tenant->custom_domain ?? null) ?: ($tenant->subdomain ?? 'sitio').'.'.config('sites.domain', 'kipucontrol.site');

        return 'https://'.$host.$path;
    }
}
