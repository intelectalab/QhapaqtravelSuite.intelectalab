<?php

declare(strict_types=1);

namespace App\Domain\Landing\Actions;

use App\Domain\Landing\Contracts\RucLookup;
use App\Domain\Landing\Support\SignupQuote;
use App\Domain\Landing\Support\SignupState;
use App\Domain\Platform\Actions\PlatformSession;
use App\Domain\Platform\Actions\ProvisionTenant;
use App\Domain\Platform\Http\Requests\TenantProvisionRequest;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Tracking\Actions\ConversionWorkflow;
use App\Domain\Tracking\Support\TagScope;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

final class RegisterSignup
{
    private const COMMON_PASSWORDS = ['1234567890', '0123456789', 'contraseña', 'contrasena', 'password12', 'password123', 'qwertyuiop', '1q2w3e4r5t', 'kipucontrol', 'admin12345', 'peru123456', 'iloveyou12', '11111111111', 'abcdefghij', 'turismo123'];

    private const FREE_MAIL = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'yahoo.es', 'live.com', 'icloud.com', 'proton.me', 'protonmail.com'];

    public function __construct(
        private readonly SignupQuote $quote,
        private readonly RucLookup $ruc,
        private readonly ProvisionTenant $provision,
        private readonly PlatformSession $session,
        private readonly ConversionWorkflow $conversions,
        private readonly SignupState $state,
    ) {}

    public static function validate(array $input): array
    {
        return Validator::make($input, [
            'plan' => ['required', 'string', 'max:20'],
            'cycle' => ['required', Rule::in(array_keys(SignupQuote::CYCLES))],
            'admin_name' => ['required', 'string', 'min:3', 'max:150'],
            'email' => ['required', 'email:rfc', 'max:150'],
            'password' => ['required', 'string', 'min:10', 'max:120'],
            'phone' => ['nullable', 'string', 'max:30', 'regex:/^[0-9+()\s-]{6,30}$/'],
            'commercial_name' => ['required', 'string', 'min:2', 'max:150'],
            'ruc' => ['required', 'string'],
            'city' => ['required', 'string', 'min:2', 'max:80'],
            'business_type' => ['required', Rule::in(TenantProvisionRequest::BUSINESS_TYPES)],
            'doc_type' => ['required', 'in:factura,boleta'],
            'coupon' => ['nullable', 'string', 'max:30'],
            'addons' => ['nullable', 'array', 'max:10'],
            'addons.*' => ['integer', 'min:1', 'max:50'],
            'expected_total' => ['nullable', 'numeric', 'min:0'],
            'accept_terms' => ['accepted'],
            'terms_version' => ['required', 'string', 'max:20'],
            'marketing_consent' => ['nullable', 'boolean'],
            'utm' => ['nullable', 'array'],
            'utm.*' => ['nullable', 'string', 'max:120'],
            'gclid' => ['nullable', 'string', 'max:200'],
            'fbclid' => ['nullable', 'string', 'max:300'],
        ], [
            'plan.*' => 'Elige un plan.',
            'cycle.*' => 'Elige mensual, anual o la prueba de 14 días.',
            'admin_name.*' => 'Escribe tu nombre completo.',
            'email.*' => 'Escribe un correo válido.',
            'password.min' => 'La contraseña debe tener 10 caracteres o más.',
            'password.*' => 'Escribe una contraseña de 10 caracteres o más.',
            'phone.*' => 'Escribe un teléfono válido.',
            'commercial_name.*' => 'Escribe el nombre comercial de tu agencia.',
            'ruc.*' => 'Escribe el RUC de tu agencia.',
            'city.*' => 'Escribe la ciudad de tu agencia.',
            'business_type.*' => 'Elige el tipo de agencia.',
            'doc_type.*' => 'Elige factura o boleta.',
            'addons.*' => 'Revisa los complementos elegidos.',
            'accept_terms.accepted' => 'Acepta los términos y la política de privacidad para continuar.',
            'terms_version.*' => 'Falta la versión de los términos aceptados.',
        ])->validate();
    }

    public function __invoke(array $data): array
    {
        $email = Str::lower(trim((string) $data['email']));
        $ruc = preg_replace('/\D/', '', (string) $data['ruc']) ?? '';
        $cycle = (string) $data['cycle'];
        $trial = $cycle === 'prueba';
        $plan = $this->quote->plan((string) $data['plan']);

        if ($this->db()->table('iam_users')->whereRaw('lower(email) = ?', [$email])->whereNull('deleted_at')->exists()) {
            throw ApiException::conflict('SIGNUP_EMAIL_TAKEN', 'Ese correo ya tiene una cuenta en KipuControl. Inicia sesión para continuar.', ['field' => 'email', 'login_url' => '/login']);
        }

        $this->assertPassword((string) $data['password'], $email);

        if ($this->db()->table('tenants')->where('ruc', $ruc)->exists()) {
            throw $trial
                ? ApiException::unprocessable('TRIAL_ALREADY_USED', 'Ese RUC ya usó su prueba gratuita. Elige un plan para continuar.', ['field' => 'ruc'])
                : ApiException::conflict('SIGNUP_RUC_TAKEN', 'Ya existe una agencia con ese RUC. Inicia sesión o escríbenos para recuperar el acceso.', ['field' => 'ruc']);
        }

        if ($trial) {
            $this->assertTrialDomain($email);
        }

        $taxpayer = $this->ruc->find($ruc);

        if ($taxpayer === null || ! $taxpayer['active']) {
            throw ApiException::unprocessable('RUC_INVALID', $taxpayer === null ? 'El RUC no es válido: debe tener 11 dígitos, empezar en 10 o 20 y figurar en SUNAT.' : "El RUC figura en SUNAT como {$taxpayer['status']}. Usa un RUC activo.", ['field' => 'ruc']);
        }

        $coupon = ! $trial && filled($data['coupon'] ?? null) ? $this->quote->coupon((string) $data['coupon'], $plan) : null;
        $addons = $this->quote->addons((array) ($data['addons'] ?? []), $plan);
        $totals = $this->quote->totals($plan, $cycle, $coupon, $addons);

        if (isset($data['expected_total']) && ! BigDecimal::of((string) $data['expected_total'])->toScale(2, RoundingMode::HALF_UP)->isEqualTo(BigDecimal::of($totals['total']))) {
            throw ApiException::unprocessable('SIGNUP_TOTAL_CHANGED', "El total cambió a S/ {$totals['total']}. Revisa el resumen antes de continuar.", ['totals' => $totals]);
        }

        return $this->db()->transaction(fn (): array => $this->create($data, $email, $ruc, $cycle, $trial, $plan, $taxpayer, $coupon, $addons, $totals));
    }

    private function create(array $data, string $email, string $ruc, string $cycle, bool $trial, object $plan, array $taxpayer, ?object $coupon, array $addons, array $totals): array
    {
        $tenant = ($this->provision)([
            'legal_name' => $taxpayer['legal_name'],
            'commercial_name' => trim((string) $data['commercial_name']),
            'ruc' => $ruc,
            'fiscal_address' => $taxpayer['address'],
            'business_type' => $data['business_type'],
            'subdomain' => $this->subdomain((string) $data['commercial_name']),
            'admin_email' => $email,
            'admin_name' => trim((string) $data['admin_name']),
            'admin_phone' => $data['phone'] ?? null,
            'sede_name' => 'Sede principal',
            'sede_city' => trim((string) $data['city']),
            'sede_address' => $taxpayer['address'],
            'sede_phone' => $data['phone'] ?? null,
            'plan' => $plan->code,
            'status' => 'prueba',
            'send_invitation' => false,
        ], null);

        $this->db()->select("select set_config('app.tenant_id', '', true)");
        $token = $tenant->code.'.'.Str::random(40);
        $state = $trial ? 'prueba' : 'pago_pendiente';
        $signup = [
            'source' => 'landing',
            'state' => $state,
            'token_hash' => hash('sha256', $token),
            'plan' => $plan->code,
            'cycle' => $cycle,
            'doc_type' => $data['doc_type'],
            'coupon' => $coupon?->code,
            'addons' => collect($addons)->mapWithKeys(fn (array $addon) => [$addon['code'] => $addon['quantity']])->all(),
            'totals' => $totals,
            'marketing_consent' => (bool) ($data['marketing_consent'] ?? false),
            'terms_version' => $data['terms_version'],
            'attribution' => array_filter(['utm' => $data['utm'] ?? null, 'gclid' => $data['gclid'] ?? null, 'fbclid' => $data['fbclid'] ?? null]),
            'ip' => $this->truncatedIp(),
            'created_at' => now()->toIso8601String(),
            'history' => [['state' => 'cuenta_creada', 'at' => now()->toIso8601String()], ['state' => $state, 'at' => now()->toIso8601String()]],
        ];

        $this->db()->table('iam_users')->where('tenant_id', $tenant->getKey())->whereRaw('lower(email) = ?', [$email])
            ->update(['password' => Hash::make((string) $data['password']), 'status' => 'activo', 'created_via' => 'sitio_web', 'updated_at' => now()]);
        $this->db()->table('subscriptions')->where('tenant_id', $tenant->getKey())->update([
            'billing_doc_type' => $data['doc_type'] === 'boleta' ? 'Boleta' : 'Factura',
            ...($trial ? [] : ['status' => 'suspended', 'cycle' => SignupQuote::CYCLES[$cycle], 'trial_starts_at' => null, 'trial_ends_at' => null]),
            'updated_at' => now(),
        ]);

        if (! $trial) {
            $this->db()->table('tenants')->where('id', $tenant->getKey())->update(['status' => 'suspendido', 'suspend_reason' => 'Alta desde la landing pendiente de pago.', 'suspended_at' => now(), 'trial_ends_at' => null, 'mrr' => 0, 'updated_at' => now()]);
        }

        $this->state->put((string) $tenant->getKey(), $signup);
        $this->session->log('Alta landing', $tenant->code, $trial ? 'alta_prueba' : 'alta_iniciada', null, "{$plan->name} · {$cycle} · S/ {$totals['total']} · términos {$data['terms_version']} · IP {$signup['ip']}");
        $this->conversions->record(TagScope::platform(), 'registro_agencia', (string) Str::uuid7(), null, null, $signup['marketing_consent'], ['reference' => $tenant->code]);

        return [
            'token' => $token,
            'state' => $state,
            'tenant' => $tenant->code,
            'totals' => $totals,
            'next' => $trial ? 'bienvenida' : 'pago',
        ];
    }

    private function assertPassword(string $password, string $email): void
    {
        $lower = Str::lower($password);

        if (in_array($lower, self::COMMON_PASSWORDS, true) || str_contains($lower, Str::before($email, '@')) || count(array_unique(str_split($password))) < 4) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'Esa contraseña es muy fácil de adivinar o aparece en listas filtradas. Usa otra.', ['field' => 'password']);
        }
    }

    private function assertTrialDomain(string $email): void
    {
        $domain = Str::after($email, '@');

        if (in_array($domain, self::FREE_MAIL, true)) {
            return;
        }

        $used = $this->db()->table('tenants')->whereRaw("settings->'signup'->>'cycle' = 'prueba'")
            ->where('created_at', '>=', now()->subMonths(12))
            ->whereRaw('lower(admin_email) like ?', ['%@'.addcslashes($domain, '%_\\')])
            ->exists();

        if ($used) {
            throw ApiException::unprocessable('TRIAL_ALREADY_USED', 'Tu empresa ya usó la prueba gratuita en los últimos 12 meses. Elige un plan para continuar.', ['field' => 'email']);
        }
    }

    private function subdomain(string $name): string
    {
        $base = mb_substr(trim(Str::slug($name), '-'), 0, 24) ?: 'agencia';
        $base = strlen($base) < 3 ? $base.'-pe' : $base;
        $candidate = $base;
        $suffix = 2;

        while ($this->db()->table('tenants')->where('subdomain', $candidate)->exists()) {
            $candidate = $base.'-'.$suffix++;
        }

        return $candidate;
    }

    private function truncatedIp(): string
    {
        $ip = (string) Request::ip();

        return filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) ? (preg_replace('/\.\d+$/', '.0', $ip) ?? $ip) : implode(':', array_slice(explode(':', $ip), 0, 3)).'::';
    }

    private function db(): ConnectionInterface
    {
        return DB::connection('pgsql_platform');
    }
}
