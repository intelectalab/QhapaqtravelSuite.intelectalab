<?php

declare(strict_types=1);

namespace App\Domain\Landing\Actions;

use App\Domain\Platform\Actions\PlatformSession;
use App\Domain\Platform\Http\Requests\DemoRequestStoreRequest;
use App\Domain\Platform\Http\Requests\TenantProvisionRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

final class RegisterSalesLead
{
    public const SOURCES = ['chatbot', 'popup', 'formulario', 'precios'];

    private const KINDS = ['ventas' => 'demo', 'demo' => 'demo', 'prueba' => 'trial'];

    public function __construct(private readonly PlatformSession $session) {}

    public static function validate(array $input): array
    {
        return Validator::make($input, [
            'full_name' => ['required', 'string', 'min:3', 'max:150'],
            'email' => ['required', 'email:rfc', 'max:190'],
            'phone' => ['nullable', 'string', 'max:30', 'regex:/^[0-9+()\s-]{6,30}$/'],
            'company' => ['required', 'string', 'min:2', 'max:150'],
            'business_type' => ['required', Rule::in(TenantProvisionRequest::BUSINESS_TYPES)],
            'team_size' => ['required', Rule::in(DemoRequestStoreRequest::TEAM_SIZES)],
            'city' => ['nullable', 'string', 'max:80'],
            'intent' => ['required', Rule::in(array_keys(self::KINDS))],
            'source' => ['required', Rule::in(self::SOURCES)],
            'plan' => ['nullable', 'string', 'max:20'],
            'message' => ['nullable', 'string', 'max:2000'],
            'transcript' => ['nullable', 'string', 'max:6000'],
            'utm' => ['nullable', 'array'],
            'utm.*' => ['nullable', 'string', 'max:120'],
            'consent' => ['accepted'],
            'website' => ['nullable', 'string', 'max:0'],
        ], [
            'full_name.*' => 'Escribe tu nombre.',
            'email.*' => 'Escribe un correo válido.',
            'phone.*' => 'Escribe un teléfono válido.',
            'company.*' => 'Escribe el nombre de tu agencia.',
            'business_type.*' => 'Elige el tipo de agencia.',
            'team_size.*' => 'Elige el tamaño de tu equipo.',
            'intent.*' => 'Elige qué necesitas: ventas, demo o prueba.',
            'source.*' => 'Origen del contacto no reconocido.',
            'consent.accepted' => 'Acepta el tratamiento de tus datos para que te contactemos.',
            'website.max' => 'No pudimos registrar tu solicitud.',
        ])->validate();
    }

    public function __invoke(array $data): array
    {
        $db = DB::connection('pgsql_platform');
        $email = Str::lower(trim((string) $data['email']));
        $previous = $db->table('platform_demo_requests')->whereRaw('lower(email) = ?', [$email])->where('status', 'nueva')->where('created_at', '>=', now()->subDay())->value('code');

        if ($previous !== null) {
            return ['code' => $previous, 'repeated' => true];
        }

        $plan = filled($data['plan'] ?? null) ? $db->table('plans')->where('code', $data['plan'])->where('status', 'active')->first(['id']) : null;
        $message = trim(implode("\n\n", array_filter([
            $data['message'] ?? null,
            isset($data['transcript']) ? "Conversación con Kipu:\n".$data['transcript'] : null,
            ! empty($data['utm']) ? 'Campaña: '.collect($data['utm'])->map(fn ($value, $key) => "{$key}={$value}")->implode(', ') : null,
        ])));

        return $db->transaction(function () use ($db, $data, $email, $plan, $message): array {
            $code = (string) $db->table('platform_demo_requests')->insertGetId([
                'kind' => self::KINDS[$data['intent']],
                'plan_id' => $plan?->id,
                'billing_cycle' => $plan ? 'month' : null,
                'full_name' => trim((string) $data['full_name']),
                'email' => $email,
                'phone' => isset($data['phone']) ? trim((string) $data['phone']) : null,
                'company' => trim((string) $data['company']),
                'business_type' => $data['business_type'],
                'city' => isset($data['city']) ? trim((string) $data['city']) : null,
                'team_size' => $data['team_size'],
                'message' => $message === '' ? null : mb_substr($message, 0, 8000),
                'source' => 'landing_'.$data['source'],
                'ip' => Request::ip(),
                'user_agent' => mb_substr((string) Request::userAgent(), 0, 250) ?: null,
                'consent_at' => now(),
            ], 'code');
            $this->session->log('Solicitud comercial', $code, 'lead_landing', null, trim((string) $data['company'])." · {$data['intent']} · {$data['source']}");

            return ['code' => $code, 'repeated' => false];
        });
    }
}
