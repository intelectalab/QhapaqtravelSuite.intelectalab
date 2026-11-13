<?php

declare(strict_types=1);

namespace App\Domain\Platform\Http\Controllers;

use App\Domain\Admin\Support\Branding;
use App\Domain\Platform\Actions\UpdateFormProtection;
use App\Domain\Platform\Actions\UpdateOutgoingMail;
use App\Domain\Platform\Actions\UpdatePlatformSettings;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Support\OutgoingMail;
use App\Domain\Platform\Support\PlatformBranding;
use App\Domain\Platform\Support\PlatformNotifications;
use App\Domain\Platform\Support\PlatformSearch;
use App\Domain\Platform\Support\PlatformSettings;
use App\Domain\Shared\Concurrency\IfMatch;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class PlatformSettingsController
{
    public function notifications(Request $request, PlatformNotifications $notifications): JsonResponse
    {
        $feed = $notifications->feed($this->user($request));

        return response()->json(['data' => $feed['items'], 'meta' => ['unread_count' => $feed['unread'], 'can_view_log' => false]]);
    }

    public function readNotifications(Request $request, PlatformNotifications $notifications): JsonResponse
    {
        return response()->json(['data' => ['marked' => $notifications->readAll($this->user($request))]]);
    }

    public function search(Request $request, PlatformSearch $search): JsonResponse
    {
        $data = $request->validate(['q' => ['required', 'string', 'min:'.PlatformSearch::MIN, 'max:80']], ['q.*' => 'Escribe al menos '.PlatformSearch::MIN.' caracteres.']);

        return response()->json(['data' => $search->search($data['q']), 'meta' => ['scope' => 'platform']]);
    }

    public function branding(PlatformBranding $branding): JsonResponse
    {
        return response()->json(['data' => $branding->overview()]);
    }

    public function saveBranding(Request $request, PlatformBranding $branding): JsonResponse
    {
        $data = $request->validate([
            'brand' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'accent' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'menu' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'tile_variant' => ['required', Rule::in(array_keys(Branding::VARIANTS))],
        ], ['*.regex' => 'Elige un color válido (#RRGGBB).', 'tile_variant.*' => 'Elige un diseño de tarjeta.']);

        return response()->json(['data' => ['changed' => $branding->save(array_map('strtolower', $data), $this->user($request))]]);
    }

    public function resetBranding(Request $request, PlatformBranding $branding): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:300']], ['reason.*' => 'Escribe el motivo (mínimo 3 caracteres).']);
        $branding->reset($data['reason'], $this->user($request));

        return response()->json(['data' => ['reset' => true]]);
    }

    public function updateFormProtection(Request $request, UpdateFormProtection $forms): JsonResponse
    {
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'site_key' => ['nullable', 'string', 'max:120', 'regex:/^[A-Za-z0-9_-]*$/'],
            'secret' => ['nullable', 'string', 'max:200', 'regex:/^[A-Za-z0-9_-]*$/'],
        ], [
            'enabled.*' => 'Indica si la protección queda activa.',
            'site_key.*' => 'Pega la clave del sitio tal como la muestra Cloudflare.',
            'secret.*' => 'Pega la clave secreta tal como la muestra Cloudflare.',
        ]);

        return response()->json(['data' => $forms->update((bool) $data['enabled'], (string) ($data['site_key'] ?? ''), $data['secret'] ?? null, $this->user($request))]);
    }

    public function updateOutgoingMail(Request $request, UpdateOutgoingMail $mail): JsonResponse
    {
        $enabled = $request->boolean('enabled');
        $required = $enabled ? 'required' : 'nullable';
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'host' => [$required, 'string', 'max:190', 'regex:/^[A-Za-z0-9.-]+$/'],
            'port' => [$required, 'integer', 'min:1', 'max:65535'],
            'encryption' => ['required', Rule::in(OutgoingMail::ENCRYPTIONS)],
            'username' => [$required, 'string', 'max:190'],
            'password' => ['nullable', 'string', 'max:255'],
            'from_address' => [$required, 'email', 'max:190'],
            'from_name' => ['nullable', 'string', 'max:120'],
            'ses_webhook_secret' => ['nullable', 'string', 'min:16', 'max:255'],
            'fcm_webhook_secret' => ['nullable', 'string', 'min:16', 'max:255'],
        ], [
            'ses_webhook_secret.*' => 'El secreto de acuses del correo debe tener entre 16 y 255 caracteres.',
            'fcm_webhook_secret.*' => 'El secreto de acuses push debe tener entre 16 y 255 caracteres.',
            'enabled.*' => 'Indica si el correo de salida queda activo.',
            'host.*' => 'Escribe el servidor de salida, por ejemplo mail.tudominio.com.',
            'port.*' => 'El puerto va de 1 a 65535. Con SSL suele ser 465 y con STARTTLS, 587.',
            'encryption.*' => 'Elige el cifrado.',
            'username.*' => 'Escribe el usuario del buzón, casi siempre la dirección completa.',
            'password.*' => 'La contraseña no puede pasar de 255 caracteres.',
            'from_address.*' => 'Escribe un remitente válido.',
            'from_name.*' => 'El nombre del remitente no puede pasar de 120 caracteres.',
        ]);

        return response()->json(['data' => $mail->update($data, $request->input('password'), $this->user($request), ['ses' => $data['ses_webhook_secret'] ?? null, 'fcm' => $data['fcm_webhook_secret'] ?? null])]);
    }

    public function testOutgoingMail(Request $request, UpdateOutgoingMail $mail): JsonResponse
    {
        $data = $request->validate(['to' => ['required', 'email', 'max:190']], ['to.*' => 'Escribe el correo que recibirá la prueba.']);

        return response()->json(['data' => $mail->sendTest(mb_strtolower((string) $data['to']), $this->user($request))]);
    }

    public function settings(UpdatePlatformSettings $settings): JsonResponse
    {
        return response()->json(['data' => $settings->overview()]);
    }

    public function updateSettings(Request $request, string $section, UpdatePlatformSettings $settings, PlatformSettings $values): JsonResponse
    {
        $expected = IfMatch::from($request);
        IfMatch::assertMatches($expected, $values->version(), 'La configuración');

        $data = $request->validate(match ($section) {
            'issuer' => [
                'name' => ['required', 'string', 'max:160'],
                'ruc' => ['required', 'regex:/^20\d{9}$/'],
                'address' => ['required', 'string', 'max:255'],
                'email' => ['required', 'email', 'max:160'],
                'web' => ['nullable', 'string', 'max:120'],
            ],
            'taxes' => ['igv_pct' => ['required', 'numeric', 'min:0', 'max:30']],
            'notices' => [
                'trial_days' => ['required', 'array', 'min:1', 'max:5'],
                'trial_days.*' => ['integer', 'min:0', 'max:30'],
                'usage_warn_pct' => ['required', 'integer', 'min:50', 'max:99'],
                'api_key_days' => ['required', 'integer', 'min:1', 'max:30'],
            ],
            default => throw ApiException::notFound('La sección no existe.'),
        }, [
            'ruc.*' => 'El RUC del emisor tiene 11 dígitos y empieza con 20.',
            'email.*' => 'Escribe un correo válido.',
            'igv_pct.*' => 'El IGV va de 0 a 30 %.',
            'trial_days.*' => 'Elige entre 1 y 5 días de aviso, de 0 a 30.',
            'usage_warn_pct.*' => 'El aviso de uso va de 50 a 99 %.',
            'api_key_days.*' => 'El aviso de llaves va de 1 a 30 días.',
        ]);

        return response()->json(['data' => ['changed' => $settings->update($section, $data, $this->user($request)), 'lock_version' => $values->version()]]);
    }

    private function user(Request $request): PlatformUser
    {
        $user = $request->user('sanctum');
        assert($user instanceof PlatformUser);

        return $user;
    }
}
