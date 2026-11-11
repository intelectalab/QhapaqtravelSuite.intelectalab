<?php

declare(strict_types=1);

namespace Database\Support;

use App\Domain\Catalog\Actions\AllotmentRegistry;
use App\Domain\Catalog\Support\AllotmentConsumption;
use App\Domain\Iam\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class AllotmentSamples
{
    private const CONTRACTS = [
        ['service' => 'SRV-008', 'name' => 'Tambo Real, hab. doble estándar (2.º semestre)', 'ref' => 'Adenda 03 · contrato de alojamiento 2026', 'from' => -28, 'to' => 82, 'qty' => 8, 'release' => 14, 'rate' => 88, 'currency' => 'USD', 'penalty' => 100, 'notes' => 'Bloqueo base de 8 habitaciones por noche. Lo retenido después del release se paga al 100 % de la tarifa neta.'],
        ['service' => 'SRV-009', 'name' => 'Piedra Viva, hab. deluxe (temporada intermedia)', 'ref' => 'Contrato de cupo PV-2026-07', 'from' => -14, 'to' => 62, 'qty' => 3, 'release' => 21, 'rate' => 165, 'currency' => 'USD', 'penalty' => 100, 'notes' => 'Cupo garantizado de 3 habitaciones deluxe. Release a 21 días.', 'pending' => true],
        ['service' => 'SRV-003', 'name' => 'Expedition Ollantaytambo y Aguas Calientes', 'ref' => 'Convenio corporativo FSA-2026-114', 'from' => -90, 'to' => 93, 'qty' => 20, 'release' => 10, 'rate' => 142, 'currency' => 'USD', 'penalty' => 50, 'notes' => '20 asientos diarios, ida y vuelta. Penalidad del 50 % sobre lo retenido y no usado.'],
        ['service' => 'SRV-005', 'name' => 'Entradas Machu Picchu, circuito 2 (nominativas)', 'ref' => 'Cupo operador turístico RD-0412-2026', 'from' => -28, 'to' => 32, 'qty' => 25, 'release' => 7, 'rate' => 152, 'currency' => 'PEN', 'penalty' => 0, 'notes' => 'Las entradas no nominadas 7 días antes vuelven a la plataforma de venta. Sin penalidad económica.'],
        ['service' => 'SRV-010', 'name' => 'Valle Inka, hab. doble (invierno)', 'ref' => 'Contrato de cupo VI-2026-02', 'from' => -120, 'to' => -2, 'qty' => 4, 'release' => 7, 'rate' => 170, 'currency' => 'PEN', 'penalty' => 50, 'notes' => 'Contrato de temporada de invierno, por evaluar su renovación.'],
    ];

    public function seed(User $actor): void
    {
        DB::transaction(function () use ($actor): void {
            DB::select('select app_set_tenant(?::uuid)', [$actor->tenant_id]);
            $this->fill($actor);
        });
    }

    private function fill(User $actor): void
    {
        $registry = app(AllotmentRegistry::class);
        $today = Carbon::today('America/Lima');
        $codes = [];

        foreach (self::CONTRACTS as $index => $seed) {
            $service = DB::table('catalog_services')->where('ref', $seed['service'])->whereNull('deleted_at')->first(['id', 'provider_id']);

            if ($service === null || DB::table('catalog_allotments')->where('service_id', $service->id)->where('name', $seed['name'])->exists()) {
                continue;
            }

            $codes[$index] = $registry->create([
                'provider_id' => $service->provider_id,
                'service_id' => $service->id,
                'name' => $seed['name'],
                'contract_ref' => $seed['ref'],
                'valid_from' => $today->copy()->addDays($seed['from'])->toDateString(),
                'valid_to' => $today->copy()->addDays($seed['to'])->toDateString(),
                'base_qty' => $seed['qty'],
                'release_days' => $seed['release'],
                'net_rate' => $seed['rate'],
                'currency' => $seed['currency'],
                'penalty_pct' => $seed['penalty'],
                'notes' => $seed['notes'],
            ], $actor);
        }

        if (isset($codes[0])) {
            $first = $registry->requestExpansion($codes[0], ['date_from' => $today->copy()->addDays(2)->toDateString(), 'date_to' => $today->copy()->addDays(5)->toDateString(), 'extra_qty' => 2, 'note' => 'Incentivo corporativo de 12 pasajeros'], $actor);
            $registry->respondExpansion($codes[0], $first, true, 'Aceptada por reservas del hotel', $actor);
            $registry->requestExpansion($codes[0], ['date_from' => $today->copy()->addDays(16)->toDateString(), 'date_to' => $today->copy()->addDays(19)->toDateString(), 'extra_qty' => 4, 'note' => 'Convención de laboratorios en negociación'], $actor);
        }

        if (isset($codes[2])) {
            $train = $registry->requestExpansion($codes[2], ['date_from' => $today->copy()->addDays(11)->toDateString(), 'date_to' => $today->copy()->addDays(13)->toDateString(), 'extra_qty' => 6, 'note' => 'Feriado largo con demanda web'], $actor);
            $registry->respondExpansion($codes[2], $train, true, 'Aceptada por la mesa corporativa', $actor);
        }

        if (isset($codes[0])) {
            foreach (range(1, 2) as $offset) {
                $registry->retain($codes[0], $today->copy()->addDays($offset)->toDateString(), 'Posible ampliación del grupo corporativo', null, $actor);
            }
        }

        foreach ($codes as $index => $code) {
            $this->history($code, self::CONTRACTS[$index], $today, $actor);
        }
    }

    private function history(string $code, array $seed, Carbon $today, User $actor): void
    {
        $contract = DB::table('catalog_allotments')->where('code', $code)->first();
        $days = DB::table('catalog_allotment_days')->where('allotment_id', $contract->id)->whereNull('retained_at')->where('release_deadline', '<=', $today->toDateString())->orderBy('service_date')->get();
        $charged = false;

        foreach ($days as $day) {
            $free = max(0, (int) $day->blocked_qty - (int) $day->released_qty - (int) $day->used_qty - (int) $day->pending_qty);
            $past = $day->service_date < $today->toDateString();

            if (($seed['pending'] ?? false) && ! $past) {
                continue;
            }

            if ($past && ! $charged && $free > 0 && (float) $contract->penalty_pct > 0) {
                $amount = round(min($free, 1) * (float) $contract->net_rate * (float) $contract->penalty_pct / 100, 2);
                DB::table('catalog_allotment_days')->where('id', $day->id)->update(['released_qty' => (int) $day->released_qty + $free - 1, 'closed_at' => now()]);
                DB::table('catalog_allotment_charges')->insert(['allotment_day_id' => $day->id, 'qty' => 1, 'amount' => $amount, 'currency' => $contract->currency, 'reason' => "No uso de 1 unidad retenida del {$day->service_date}"]);
                DB::table('catalog_allotment_events')->insert(['allotment_id' => $contract->id, 'message' => "Cargo por no uso: 1 unidad del {$day->service_date} · {$contract->currency} {$amount} (JOB-10)"]);
                $charged = true;

                continue;
            }

            DB::table('catalog_allotment_days')->where('id', $day->id)->update(['released_qty' => (int) $day->released_qty + $free, 'closed_at' => $past ? now() : null]);
        }

        $fresh = DB::table('catalog_allotments')->where('id', $contract->id)->first();
        $status = app(AllotmentConsumption::class)->status($fresh, $today->toDateString());
        DB::table('catalog_allotments')->where('id', $contract->id)->update(['status' => $status]);
        DB::table('catalog_allotment_events')->insert(['allotment_id' => $contract->id, 'user_id' => $actor->getKey(), 'message' => 'Release automático de las fechas vencidas (JOB-10)']);
    }
}
