<?php

declare(strict_types=1);

namespace App\Domain\Site\Actions;

use App\Domain\Crm\Support\BusinessDays;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Site\Support\SiteCatalog;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CaptureWebLead
{
    public const POLICY_VERSION = 'PDP-2026.1';

    private const OPEN = ['nuevo', 'contactado', 'calificado'];

    public function __construct(
        private readonly TenantContext $context,
        private readonly CodeSequence $codes,
        private readonly BusinessDays $days,
        private readonly AuditLogger $audit,
        private readonly SiteCatalog $catalog,
    ) {}

    public function handle(array $data, string $origin): array
    {
        $now = Carbon::now($this->context->timezone());
        $email = Str::lower(trim($data['email']));
        $product = isset($data['product']) ? $this->catalog->products()->firstWhere('slug', $data['product']) : null;
        $destinations = $this->catalog->destinations()->whereIn('slug', $data['destinations'] ?? [])->values();
        $label = $destinations->pluck('name')->implode(', ') ?: ($product?->destination_name);
        $open = DB::table('crm_leads')->whereNull('deleted_at')->where('email_norm', $email)->whereIn('status', self::OPEN)->orderByDesc('created_at')->first(['id', 'code']);
        $client = DB::table('crm_clients')->whereNull('deleted_at')->where('email_norm', $email)->value('id');
        $adults = (int) ($data['adults'] ?? 1);
        $children = (int) ($data['children'] ?? 0);
        $code = $this->codes->next('crm_leads', 'LEAD-');
        $slaDue = $this->days->add($now, 1)->setTimeFrom($now);

        DB::table('crm_leads')->insert([
            'id' => (string) Str::uuid7(),
            'tenant_id' => $this->context->idOrFail(),
            'code' => $code,
            'full_name' => trim($data['name']),
            'email' => $email,
            'phone' => $data['phone'] ?? null,
            'phone_norm' => $this->phoneNorm($data['phone'] ?? null),
            'channel_code' => 'web',
            'source_code' => 'formulario_web',
            'interest_code' => $this->interest($product?->kind, $data['service_mode'] ?? null),
            'destination_id' => $destinations->first()->id ?? $product?->destination_id,
            'destination_label' => $label ? Str::limit($label, 117) : null,
            'product_id' => $product?->id,
            'travel_date' => $data['start_date'] ?? null,
            'pax' => $adults + $children,
            'status' => $open ? 'duplicado' : 'nuevo',
            'owner_id' => null,
            'score' => $this->score($data, $product !== null),
            'notes' => $this->notes($data, $origin),
            'duplicate_of_type' => $open ? 'lead' : null,
            'duplicate_of_id' => $open?->id,
            'matched_client_id' => $client,
            'sla_due_at' => $slaDue,
            'web_request' => json_encode(array_filter([
                'origin' => $origin,
                'destinations' => $destinations->pluck('slug')->all(),
                'return_date' => $data['end_date'] ?? null,
                'flexibility' => $data['flexibility'] ?? null,
                'adults' => $adults,
                'children' => $children,
                'budget' => isset($data['budget']) ? (float) $data['budget'] : null,
                'interests' => $data['interests'] ?? [],
                'hotel' => $data['hotel'] ?? null,
                'service_mode' => $data['service_mode'] ?? null,
                'country' => $data['country'] ?? null,
                'preferred_contact' => $data['preferred_contact'] ?? null,
            ], fn ($value) => $value !== null && $value !== []), JSON_UNESCAPED_UNICODE),
            'consent' => json_encode(['data_processing' => true, 'ts' => $now->toIso8601String(), 'policy_version' => self::POLICY_VERSION], JSON_UNESCAPED_UNICODE),
        ]);

        $this->audit->log('Lead', $code, 'crear_desde_sitio_web', after: $open ? "duplicado de {$open->code}" : 'nuevo');

        return ['code' => $code, 'sla_due_at' => $slaDue->toIso8601String(), 'duplicate' => $open !== null];
    }

    private function score(array $data, bool $hasProduct): int
    {
        $pax = (int) ($data['adults'] ?? 1) + (int) ($data['children'] ?? 0);

        return min(95, 40
            + (! empty($data['start_date']) ? 12 : 0)
            + ($pax >= 4 ? 10 : 0)
            + (! empty($data['phone']) ? 6 : 0)
            + ((float) ($data['budget'] ?? 0) >= 2000 ? 12 : 0)
            + ($hasProduct ? 8 : 0));
    }

    private function interest(?string $kind, ?string $mode): string
    {
        return match (true) {
            $kind === 'paquetes' || $mode === 'paquete' => 'paquete',
            $kind === 'experiencias' || $kind === 'tours' => 'tour',
            default => 'paquete',
        };
    }

    private function notes(array $data, string $origin): string
    {
        $lines = array_filter([
            $origin === 'contacto' ? 'Recibido desde el formulario de contacto del sitio web.' : 'Solicitud de viaje a medida desde el sitio web.',
            isset($data['end_date']) ? "Regreso: {$data['end_date']}." : null,
            isset($data['flexibility']) ? "Flexibilidad: {$data['flexibility']}." : null,
            isset($data['budget']) ? 'Presupuesto por persona: US$ '.number_format((float) $data['budget'], 0, '.', ' ').'.' : null,
            ! empty($data['interests']) ? 'Intereses: '.implode(', ', $data['interests']).'.' : null,
            isset($data['preferred_contact']) ? "Prefiere contacto por {$data['preferred_contact']}." : null,
            isset($data['comments']) ? trim($data['comments']) : null,
        ]);

        return implode("\n", $lines);
    }

    private function phoneNorm(?string $phone): ?string
    {
        $digits = preg_replace('/\D/', '', (string) $phone);

        return $digits === '' ? null : substr($digits, -9);
    }
}
