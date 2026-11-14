<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Http\Controllers;

use App\Domain\Inbox\Actions\WhatsappWebhookRouter;
use App\Domain\Inbox\Support\WhatsappAccounts;
use App\Domain\Integrations\Support\ChannelWebhooks;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantDatabase;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

final class OwnWhatsappWebhookController
{
    public function __construct(private readonly TenantDatabase $database, private readonly WhatsappAccounts $accounts) {}

    public function verify(Request $request, string $agency): Response
    {
        $mode = (string) ($request->query('hub_mode') ?? $request->query('hub.mode', ''));
        $token = (string) ($request->query('hub_verify_token') ?? $request->query('hub.verify_token', ''));
        $challenge = (string) ($request->query('hub_challenge') ?? $request->query('hub.challenge', ''));
        $tenant = $this->tenant($agency);
        $expected = $this->database->run($tenant, fn (): string => (string) ($this->accounts->credentials($this->own())['verify_token'] ?? ''));

        if ($mode !== 'subscribe' || preg_match('/^[A-Za-z0-9_-]{1,200}$/', $challenge) !== 1 || $expected === '' || $token === '' || ! hash_equals($expected, $token)) {
            throw ApiException::forbidden('WEBHOOK_VERIFY_TOKEN_INVALID', 'El token de verificación no coincide con el de tu app de Meta en Canales e integración.', ['verify_token']);
        }

        return response($challenge, 200, ['Content-Type' => 'text/plain; charset=UTF-8']);
    }

    public function receive(Request $request, string $agency, ChannelWebhooks $webhooks, WhatsappWebhookRouter $router): JsonResponse
    {
        $raw = $request->getContent();
        $tenant = $this->tenant($agency);
        $account = $this->database->run($tenant, function () use ($webhooks, $raw, $request): object {
            $account = $this->own() ?? throw ApiException::notFound('La agencia no tiene una app de Meta propia conectada.');
            $webhooks->verify((string) $account->id, $raw, (string) $request->header(ChannelWebhooks::SIGNATURE_HEADER, ''));

            return (object) ['tenant_id' => $account->tenant_id, 'account_id' => $account->id, 'phone_number_id' => $account->phone_number_id, 'waba_id_hash' => $account->waba_id_hash];
        });

        return response()->json(['data' => $router->route(InboundChannelController::meta($raw), $account)], 202);
    }

    private function tenant(string $agency): string
    {
        $id = DB::connection('pgsql_platform')->table('tenants')->where('subdomain', strtolower($agency))->value('id');

        return $id === null ? throw ApiException::notFound('La agencia de esta dirección no existe.') : (string) $id;
    }

    private function own(): ?object
    {
        $account = $this->accounts->account();

        return $account !== null && ($account->connection_mode ?? null) === 'propia' && $account->status !== 'inactivo' ? $account : null;
    }
}
