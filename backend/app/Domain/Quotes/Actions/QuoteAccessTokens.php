<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Actions;

use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class QuoteAccessTokens
{
    private const CLOSED = ['convertida', 'rechazada', 'cancelada'];

    public function __construct(private readonly AuditLogger $audit, private readonly TenantContext $context) {}

    public static function hash(string $plain): string
    {
        return hash('sha256', $plain);
    }

    public const PATTERN = '/^([a-z0-9-]{2,63})\.([a-f0-9]{64})$/';

    public function plain(string $tokenId, string $quoteId): string
    {
        return mb_strtolower((string) $this->context->tenant()->subdomain).'.'.hash_hmac('sha256', "{$tokenId}|{$quoteId}", (string) config('app.key'));
    }

    public static function url(string $plain): string
    {
        return rtrim((string) config('app.frontend_url'), '/').'/c/'.$plain;
    }

    public function regenerate(string $code, User $actor): array
    {
        return DB::transaction(function () use ($code, $actor): array {
            $quote = Portfolio::scope(DB::table('quote_quotes')->whereNull('deleted_at'), $actor, 'owner_id')->where('code', $code)->lockForUpdate()->first(['id', 'code', 'status', 'valid_until'])
                ?? throw Portfolio::missing($actor, 'quote_quotes', $code, 'La cotización no existe.', 'Esta cotización');

            if (in_array($quote->status, self::CLOSED, true)) {
                throw ApiException::conflict('QTE-BR-22', 'Una cotización '.$quote->status.' ya no comparte enlace con el cliente.');
            }

            return $this->issue($quote, $actor);
        });
    }

    public function ensure(object $quote, User $actor): array
    {
        $active = $this->active((string) $quote->id);

        if ($active !== null) {
            $expires = Carbon::parse((string) $quote->valid_until)->toDateString();
            DB::table('quote_access_tokens')->where('id', $active->id)->update(['expires_at' => $expires]);

            return ['url' => self::url($this->plain((string) $active->id, (string) $quote->id)), 'expires_at' => $expires, 'regenerated' => false];
        }

        return $this->issue($quote, $actor);
    }

    public function state(string $quoteId): array
    {
        $token = $this->active($quoteId);
        $view = DB::table('quote_views')->where('quote_id', $quoteId)->orderByDesc('viewed_at')->first(['viewed_at', 'source']);

        return [
            'active' => $token !== null,
            'url' => $token === null ? null : self::url($this->plain((string) $token->id, $quoteId)),
            'created_at' => $token->created_at ?? null,
            'expires_at' => $token->expires_at ?? null,
            'last_view_at' => $view->viewed_at ?? null,
            'last_view_source' => $view->source ?? null,
        ];
    }

    private function active(string $quoteId): ?object
    {
        return DB::table('quote_access_tokens')->where('quote_id', $quoteId)->whereNull('revoked_at')->orderByDesc('created_at')->first(['id', 'created_at', 'expires_at']);
    }

    private function issue(object $quote, User $actor): array
    {
        $previous = DB::table('quote_access_tokens')->where('quote_id', $quote->id)->whereNull('revoked_at')->update(['revoked_at' => now()]);
        $id = (string) Str::uuid7();
        $plain = $this->plain($id, (string) $quote->id);
        $expires = Carbon::parse((string) $quote->valid_until)->toDateString();
        DB::table('quote_access_tokens')->insert([
            'id' => $id,
            'tenant_id' => $this->context->idOrFail(),
            'quote_id' => $quote->id,
            'token_hash' => self::hash($plain),
            'expires_at' => $expires,
            'created_by' => $actor->getKey(),
        ]);
        $this->audit->log('Cotización', (string) $quote->code, $previous > 0 ? 'regenerar_token' : 'generar_token', $previous > 0 ? 'enlace anterior revocado' : null, "vence {$expires}");

        return ['url' => self::url($plain), 'expires_at' => $expires, 'regenerated' => $previous > 0];
    }
}
