<?php

declare(strict_types=1);

namespace App\Domain\Site\Http\Controllers;

use App\Domain\Documents\Actions\ClientDocuments;
use App\Domain\Documents\Support\DocumentStore;
use App\Domain\Iam\Models\User;
use App\Domain\Portal\Actions\PortalProfile;
use App\Domain\Portal\Support\PortalAccount;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Site\Actions\SiteAccount;
use App\Domain\Site\Actions\SiteAccountPayment;
use App\Domain\Site\Support\SiteAccountDirectory;
use App\Domain\Site\Support\WebClients;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

final class SiteAccountController
{
    public function __construct(private readonly SiteAccount $accounts, private readonly SiteAccountDirectory $directory) {}

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:150'],
            'email' => ['required', 'string', 'email:rfc', 'max:190'],
            'phone' => ['required', 'string', 'max:30', 'regex:/^[0-9+()\s-]{6,30}$/'],
            'country' => ['required', 'string', 'max:60'],
            'doc_type' => ['required', Rule::in(array_keys(WebClients::DOC_TYPES))],
            'doc_number' => ['required', 'string', 'min:6', 'max:20', 'regex:/^[A-Za-z0-9-]+$/'],
            'password' => ['required', 'string', 'min:8', 'max:72', 'confirmed'],
            'accept' => ['accepted'],
            'newsletter' => ['nullable', 'boolean'],
            'wishlist' => ['nullable', 'array', 'max:50'],
            'wishlist.*' => ['string', 'max:160'],
        ], [
            'name.*' => 'Escribe tu nombre completo.',
            'email.*' => 'Escribe un correo válido.',
            'phone.*' => 'Escribe un celular válido.',
            'country.*' => 'Elige tu país.',
            'doc_type.*' => 'Elige el tipo de documento.',
            'doc_number.*' => 'Escribe un número de documento válido.',
            'password.required' => 'Escribe una contraseña.',
            'password.min' => 'La contraseña necesita al menos 8 caracteres.',
            'password.confirmed' => 'Las contraseñas no coinciden.',
            'accept.accepted' => 'Acepta los términos y el tratamiento de tus datos para crear la cuenta.',
        ]);

        return $this->json($this->accounts->register($data, $data['wishlist'] ?? [], $this->cart($request)), 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'string', 'email:rfc', 'max:190'],
            'password' => ['required', 'string', 'max:72'],
            'wishlist' => ['nullable', 'array', 'max:50'],
            'wishlist.*' => ['string', 'max:160'],
        ], ['email.*' => 'Escribe tu correo.', 'password.*' => 'Escribe tu contraseña.']);

        return $this->json($this->accounts->login($data['email'], $data['password'], $data['wishlist'] ?? [], $this->cart($request)));
    }

    public function forgot(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'string', 'email:rfc', 'max:190']], ['email.*' => 'Escribe un correo válido.']);
        $this->accounts->forgot($data['email']);

        return $this->json(['message' => 'Si el correo tiene una cuenta, te enviamos un enlace para crear una contraseña nueva.']);
    }

    public function verify(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'string', 'email:rfc', 'max:190'], 'token' => ['required', 'string', 'size:64']], ['email.*' => 'El enlace no es válido.', 'token.*' => 'El enlace no es válido.']);

        return $this->json($this->accounts->verify($data['email'], $data['token']));
    }

    public function lookup(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'string', 'email:rfc', 'max:190'],
            'code' => ['required', 'string', 'max:30', 'regex:/^(RES|WEB)-[A-Za-z0-9-]+$/i'],
        ], ['email.*' => 'Escribe el correo con el que compraste.', 'code.*' => 'Escribe el código tal como aparece en tu correo (empieza con RES- o WEB-).']);

        return $this->json($this->accounts->lookup($data['email'], $data['code']));
    }

    public function logout(Request $request): JsonResponse
    {
        $this->accounts->logout($this->user($request));

        return $this->json(['message' => 'Cerraste sesión.']);
    }

    public function resendVerification(Request $request): JsonResponse
    {
        $this->accounts->resendVerification($this->user($request));

        return $this->json(['message' => 'Te enviamos un nuevo enlace de verificación.']);
    }

    public function me(Request $request): JsonResponse
    {
        return $this->json($this->directory->me($this->account($request)));
    }

    public function update(Request $request, PortalProfile $profile): JsonResponse
    {
        $account = $this->customer($request);
        $data = $request->validate([
            'email' => ['nullable', 'email', 'max:190'],
            'phone' => ['nullable', 'string', 'max:30', 'regex:/^[0-9+()\s-]{6,30}$/'],
            'city' => ['nullable', 'string', 'max:80'],
            'country' => ['nullable', 'string', 'max:60'],
            'locale' => ['required', Rule::in(PortalProfile::LOCALES)],
            'newsletter' => ['nullable', 'boolean'],
        ], [
            'email.*' => 'Escribe un correo válido.',
            'phone.*' => 'Escribe un celular válido.',
            'country.*' => 'Elige un país.',
            'locale.*' => 'Elige un idioma.',
        ]);
        $profile->update($account, $data);

        if (array_key_exists('newsletter', $data) && $data['newsletter'] !== null) {
            $current = DB::table('mkt_consents')->where('subject_type', 'client')->where('subject_id', $account->client->id)->where('channel', 'email')->value('status') === 'otorgado';
            if ($current !== (bool) $data['newsletter']) {
                $profile->consent($account, 'email', (bool) $data['newsletter'], $request->ip());
            }
        }

        return $this->json($this->directory->me(PortalAccount::of($this->user($request))));
    }

    public function reservations(Request $request): JsonResponse
    {
        return $this->json($this->directory->reservations($this->account($request)));
    }

    public function reservation(Request $request, string $code): JsonResponse
    {
        return $this->json($this->directory->reservation($this->account($request), $code));
    }

    public function vouchers(Request $request): JsonResponse
    {
        return $this->json($this->directory->vouchers($this->account($request)));
    }

    public function voucherPdf(Request $request, string $code, ClientDocuments $documents, DocumentStore $store): Response|JsonResponse
    {
        return $store->respond($documents->generate(ClientDocuments::VOUCHER, $this->directory->voucher($this->account($request), $code)), $request);
    }

    public function receivables(Request $request): JsonResponse
    {
        $status = $request->query('status');

        return $this->json($this->directory->receivables($this->account($request), is_string($status) ? $status : null));
    }

    public function pay(Request $request, string $id, SiteAccountPayment $payments): JsonResponse
    {
        return $this->json($payments->pay($this->customer($request), $id, $request->only(['method', 'card_token', 'card_holder', 'operation_ref'])));
    }

    public function wishlist(Request $request): JsonResponse
    {
        return $this->json($this->directory->wishlist($this->account($request)));
    }

    public function wish(Request $request, string $product, AuditLogger $audit): JsonResponse
    {
        $account = $this->account($request);
        $id = DB::table('catalog_products')->where('slug', $product)->whereNull('deleted_at')->value('id') ?? throw ApiException::notFound('No encontramos ese tour.');
        DB::table('channel_wishlist_items')->insertOrIgnore(['crm_client_id' => $account->client->id, 'product_id' => $id]);
        $audit->log('Lista de deseos', (string) $account->client->code, 'agregar', after: $product);

        return $this->json($this->directory->wishlist($account));
    }

    public function unwish(Request $request, string $product, AuditLogger $audit): JsonResponse
    {
        $account = $this->account($request);
        $id = DB::table('catalog_products')->where('slug', $product)->value('id');
        if ($id !== null && DB::table('channel_wishlist_items')->where('crm_client_id', $account->client->id)->where('product_id', $id)->delete() > 0) {
            $audit->log('Lista de deseos', (string) $account->client->code, 'quitar', $product);
        }

        return $this->json($this->directory->wishlist($account));
    }

    private function account(Request $request): PortalAccount
    {
        return PortalAccount::of($this->user($request));
    }

    private function customer(Request $request): PortalAccount
    {
        $account = $this->account($request);

        if ($account->isPassenger()) {
            throw ApiException::forbidden('PORTAL_CUSTOMER_ONLY', 'Esta sección es para quien hizo la reserva.');
        }

        return $account;
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }

    private function cart(Request $request): ?string
    {
        $cookie = $request->cookies->get((string) config('sites.cart_cookie'));

        return is_string($cookie) && $cookie !== '' ? $cookie : null;
    }

    private function json(array $data, int $status = 200): JsonResponse
    {
        return response()->json(['data' => $data], $status);
    }
}
