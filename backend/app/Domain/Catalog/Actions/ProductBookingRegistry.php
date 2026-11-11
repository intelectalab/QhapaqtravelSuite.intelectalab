<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Actions;

use App\Domain\Admin\Support\RuleParams;
use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Catalog\Support\ProductBookingConfig;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class ProductBookingRegistry
{
    private const PAX_FIELDS = ['adult_min_age', 'child_min_age', 'child_max_age', 'infant_max_age', 'child_pays', 'child_price_pct', 'infant_allowed', 'infant_pays', 'max_children_per_adult', 'max_infants_per_adult', 'min_adults', 'note'];

    public function __construct(
        private readonly ProductSections $sections,
        private readonly AuditLogger $audit,
        private readonly CodeSequence $codes,
        private readonly TenantContext $context,
    ) {}

    public function operation(string $code, ?int $version, array $data, User $actor): int
    {
        return $this->sections->edit($code, $version, $actor, function (object $product) use ($data): void {
            $before = $this->describeOperation($product->operating_weekdays, $product->cutoff_hours);
            $weekdays = array_values(array_unique(array_map('intval', $data['operating_weekdays'])));
            sort($weekdays);
            $cutoff = isset($data['cutoff_hours']) ? (int) $data['cutoff_hours'] : null;
            DB::table('catalog_products')->where('id', $product->id)->update(['operating_weekdays' => '{'.implode(',', $weekdays).'}', 'cutoff_hours' => $cutoff]);
            $this->log($product, 'disponibilidad_operacion', $before, $this->describeOperation($weekdays, $cutoff));
        });
    }

    public function savePaxRules(string $code, ?int $version, array $data, User $actor): int
    {
        if (! ((int) $data['infant_max_age'] < (int) $data['child_min_age'] && (int) $data['child_min_age'] <= (int) $data['child_max_age'] && (int) $data['child_max_age'] < (int) $data['adult_min_age'])) {
            throw ApiException::unprocessable('CAT-PX-01', 'Las bandas de edad deben ir en orden: infante hasta < niño desde ≤ niño hasta < adulto desde (CAT-PX-01).');
        }

        return $this->sections->edit($code, $version, $actor, function (object $product) use ($data, $actor): void {
            $values = array_intersect_key($data, array_flip(self::PAX_FIELDS));
            $values['note'] = trim((string) ($values['note'] ?? '')) ?: null;
            $previous = DB::table('catalog_pax_rules')->where('product_id', $product->id)->first();
            $previous
                ? DB::table('catalog_pax_rules')->where('id', $previous->id)->update([...$values, 'updated_by' => $actor->getKey(), 'updated_at' => now()])
                : DB::table('catalog_pax_rules')->insert([...$values, 'product_id' => $product->id, 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
            $this->log($product, 'reglas_pasajeros', $previous === null ? 'hereda la agencia' : $this->describePax((array) $previous), $this->describePax($values));
        });
    }

    public function resetPaxRules(string $code, ?int $version, User $actor): int
    {
        return $this->sections->edit($code, $version, $actor, function (object $product): void {
            $previous = DB::table('catalog_pax_rules')->where('product_id', $product->id)->first()
                ?? throw ApiException::unprocessable('CFG-BR-01', 'El producto ya usa las reglas de pasajeros de la agencia.');
            DB::table('catalog_pax_rules')->where('id', $previous->id)->delete();
            $this->log($product, 'reglas_pasajeros', $this->describePax((array) $previous), 'hereda la agencia');
        });
    }

    public function createAddon(string $code, ?int $version, array $data, User $actor): string
    {
        $addonCode = '';
        $this->sections->edit($code, $version, $actor, function (object $product) use ($data, $actor, &$addonCode): void {
            $values = $this->addonValues($product->id, $data);
            $this->releaseName($product->id, $values['name'], null);
            $addonCode = $this->codes->next('catalog_product_addons', 'ADD-', 4);
            DB::table('catalog_product_addons')->insert([...$values, 'code' => $addonCode, 'product_id' => $product->id, 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
            $this->log($product, 'adicional_crear', null, $this->describeAddon($addonCode, $values));
        });

        return $addonCode;
    }

    public function updateAddon(string $code, ?int $version, string $addon, array $data, User $actor): int
    {
        return $this->sections->edit($code, $version, $actor, function (object $product) use ($addon, $data, $actor): void {
            $current = $this->addon($product->id, $addon);
            $values = $this->addonValues($product->id, [...$this->addonInput($current), ...$data]);
            $this->releaseName($product->id, $values['name'], $current->id);
            DB::table('catalog_product_addons')->where('id', $current->id)->update([...$values, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->log($product, 'adicional_modificar', $this->describeAddon($current->code, $this->addonInput($current)), $this->describeAddon($current->code, $values));
        });
    }

    public function deleteAddon(string $code, ?int $version, string $addon, User $actor): int
    {
        return $this->sections->edit($code, $version, $actor, function (object $product) use ($addon, $actor): void {
            $current = $this->addon($product->id, $addon);
            DB::table('catalog_product_addons')->where('id', $current->id)->update(['deleted_at' => now(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->log($product, 'adicional_eliminar', $this->describeAddon($current->code, $this->addonInput($current)), null);
        });
    }

    public function accommodation(string $code, ?int $version, array $data, User $actor): int
    {
        return $this->sections->edit($code, $version, $actor, function (object $product) use ($data): void {
            $enabled = (bool) $data['enabled'];
            $currency = $data['currency'] ?? $product->accommodation_currency;
            if ($enabled && $currency === null) {
                throw ValidationException::withMessages(['currency' => 'Elige la moneda del alojamiento.']);
            }
            $values = [
                'accommodation_enabled' => $enabled,
                'accommodation_optional' => (bool) ($data['optional'] ?? $product->accommodation_optional),
                'accommodation_currency' => $currency,
                'accommodation_note' => array_key_exists('note', $data) ? (trim((string) $data['note']) ?: null) : $product->accommodation_note,
            ];
            DB::table('catalog_products')->where('id', $product->id)->update($values);
            $action = $enabled === (bool) $product->accommodation_enabled ? ($enabled ? 'alojamiento_config' : 'alojamiento_desactivar') : ($enabled ? 'alojamiento_activar' : 'alojamiento_desactivar');
            $this->log($product, $action, $this->describeLodging($product->id, (bool) $product->accommodation_enabled, (bool) $product->accommodation_optional, $product->accommodation_currency), $this->describeLodging($product->id, $enabled, $values['accommodation_optional'], $currency));
        });
    }

    public function createLeg(string $code, ?int $version, array $data, User $actor): string
    {
        $legId = '';
        $this->sections->edit($code, $version, $actor, function (object $product) use ($data, $actor, &$legId): void {
            $max = (int) DB::table('catalog_accommodation_legs')->where('product_id', $product->id)->max('sequence');
            $sequence = isset($data['sequence']) ? max(1, min((int) $data['sequence'], $max + 1)) : $max + 1;
            DB::table('catalog_accommodation_legs')->where('product_id', $product->id)->where('sequence', '>=', $sequence)->increment('sequence');
            $number = 1 + (int) DB::table('catalog_accommodation_legs')->where('product_id', $product->id)->selectRaw('max(cast(substring(code from 5) as int)) as n')->whereRaw("code ~ '^LEG-[0-9]+$'")->value('n');
            $legId = (string) Str::uuid7();
            $values = ['city' => trim($data['city']), 'destination_id' => $data['destination_id'] ?? null, 'nights' => (int) $data['nights']];
            DB::table('catalog_accommodation_legs')->insert([...$values, 'id' => $legId, 'product_id' => $product->id, 'code' => 'LEG-'.$number, 'sequence' => $sequence, 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
            $this->log($product, 'tramo_crear', null, "LEG-{$number} · {$values['city']} · {$values['nights']} noche(s) · orden {$sequence}");
        });

        return $legId;
    }

    public function updateLeg(string $code, ?int $version, string $leg, array $data, User $actor): int
    {
        return $this->sections->edit($code, $version, $actor, function (object $product) use ($leg, $data, $actor): void {
            $current = $this->leg($product->id, $leg);
            $values = [
                'city' => array_key_exists('city', $data) ? trim((string) $data['city']) : $current->city,
                'destination_id' => array_key_exists('destination_id', $data) ? $data['destination_id'] : $current->destination_id,
                'nights' => array_key_exists('nights', $data) ? (int) $data['nights'] : (int) $current->nights,
            ];
            DB::table('catalog_accommodation_legs')->where('id', $current->id)->update([...$values, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            if (isset($data['sequence']) && (int) $data['sequence'] !== (int) $current->sequence) {
                $ids = DB::table('catalog_accommodation_legs')->where('product_id', $product->id)->where('id', '<>', $current->id)->orderBy('sequence')->pluck('id')->all();
                array_splice($ids, max(0, min((int) $data['sequence'] - 1, count($ids))), 0, [$current->id]);
                $this->applyOrder($product->id, $ids);
            }
            $this->log($product, 'tramo_modificar', "{$current->code} · {$current->city} · {$current->nights} noche(s)", "{$current->code} · {$values['city']} · {$values['nights']} noche(s)");
        });
    }

    public function deleteLeg(string $code, ?int $version, string $leg, User $actor): int
    {
        return $this->sections->edit($code, $version, $actor, function (object $product) use ($leg): void {
            $current = $this->leg($product->id, $leg);
            $hotels = DB::table('catalog_accommodation_hotels')->where('leg_id', $current->id)->pluck('id');
            $this->ensureHotelsUnused($hotels->all());
            DB::table('catalog_accommodation_legs')->where('id', $current->id)->delete();
            $this->applyOrder($product->id, DB::table('catalog_accommodation_legs')->where('product_id', $product->id)->orderBy('sequence')->pluck('id')->all());
            $this->log($product, 'tramo_eliminar', "{$current->code} · {$current->city} · {$current->nights} noche(s)", null);
        });
    }

    public function reorderLegs(string $code, ?int $version, array $ids, User $actor): int
    {
        return $this->sections->edit($code, $version, $actor, function (object $product) use ($ids): void {
            $current = DB::table('catalog_accommodation_legs')->where('product_id', $product->id)->orderBy('sequence')->get(['id', 'city']);
            if (count($ids) !== $current->count() || array_diff($ids, $current->pluck('id')->all()) !== []) {
                throw ApiException::unprocessable('CAT-LG-01', 'Envía todos los tramos del producto, cada uno una vez.');
            }
            $this->applyOrder($product->id, array_values($ids));
            $cities = $current->keyBy('id');
            $this->log($product, 'tramo_reordenar', $current->pluck('city')->implode(' → '), collect($ids)->map(fn (string $id) => $cities[$id]->city)->implode(' → '));
        });
    }

    public function createHotel(string $code, ?int $version, string $leg, array $data, User $actor): string
    {
        $hotelId = '';
        $this->sections->edit($code, $version, $actor, function (object $product) use ($leg, $data, $actor, &$hotelId): void {
            $current = $this->leg($product->id, $leg);
            $this->ensureHotelName($current->id, $data['name'], null);
            $this->ensureHotelProvider($data['provider_id'] ?? null);
            $hotelId = (string) Str::uuid7();
            $prefix = 'H-'.Str::upper(Str::substr(Str::ascii(preg_replace('/[^A-Za-z]/', '', Str::ascii($current->city)) ?: 'HTL'), 0, 3)).'-';
            $number = 1 + (int) DB::table('catalog_accommodation_hotels as h')->join('catalog_accommodation_legs as l', 'l.id', '=', 'h.leg_id')->where('l.product_id', $product->id)->count();
            DB::table('catalog_accommodation_hotels')->insert(['id' => $hotelId, 'leg_id' => $current->id, 'code' => Str::limit($prefix.$number, 20, ''), 'name' => trim($data['name']), 'category' => $data['category'], 'provider_id' => $data['provider_id'] ?? null, 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
            $this->replaceRooms($hotelId, $data['room_types'], $actor);
            $this->log($product, 'hotel_crear', null, $this->describeHotel($current->city, trim($data['name']), $data['category'], $data['room_types']));
        });

        return $hotelId;
    }

    public function updateHotel(string $code, ?int $version, string $leg, string $hotel, array $data, User $actor): int
    {
        return $this->sections->edit($code, $version, $actor, function (object $product) use ($leg, $hotel, $data, $actor): void {
            $legRow = $this->leg($product->id, $leg);
            $current = DB::table('catalog_accommodation_hotels')->where('id', $hotel)->where('leg_id', $legRow->id)->first() ?? throw ApiException::notFound('El hotel no existe.');
            $before = $this->describeHotel($legRow->city, $current->name, $current->category, $this->rooms($current->id));
            $values = [
                'name' => array_key_exists('name', $data) ? trim((string) $data['name']) : $current->name,
                'category' => $data['category'] ?? $current->category,
                'provider_id' => array_key_exists('provider_id', $data) ? $data['provider_id'] : $current->provider_id,
            ];
            $this->ensureHotelName($legRow->id, $values['name'], $current->id);
            $this->ensureHotelProvider($values['provider_id']);
            DB::table('catalog_accommodation_hotels')->where('id', $current->id)->update([...$values, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            if (array_key_exists('room_types', $data)) {
                $this->replaceRooms($current->id, $data['room_types'], $actor);
            }
            $this->log($product, 'hotel_modificar', $before, $this->describeHotel($legRow->city, $values['name'], $values['category'], $this->rooms($current->id)));
        });
    }

    public function deleteHotel(string $code, ?int $version, string $leg, string $hotel, User $actor): int
    {
        return $this->sections->edit($code, $version, $actor, function (object $product) use ($leg, $hotel): void {
            $legRow = $this->leg($product->id, $leg);
            $current = DB::table('catalog_accommodation_hotels')->where('id', $hotel)->where('leg_id', $legRow->id)->first() ?? throw ApiException::notFound('El hotel no existe.');
            $this->ensureHotelsUnused([$current->id]);
            $before = $this->describeHotel($legRow->city, $current->name, $current->category, $this->rooms($current->id));
            DB::table('catalog_accommodation_hotels')->where('id', $current->id)->delete();
            $this->log($product, 'hotel_eliminar', $before, null);
        });
    }

    public function payment(string $code, ?int $version, array $data, User $actor): int
    {
        return $this->sections->edit($code, $version, $actor, function (object $product) use ($data, $actor): void {
            $modes = array_values(array_intersect(ProductBookingConfig::PAYMENT_MODES, $data['modes']));
            $values = [
                'modes' => '{'.implode(',', $modes).'}',
                'deposit_pct' => isset($data['deposit_pct']) ? (int) $data['deposit_pct'] : null,
                'balance_due_days' => isset($data['balance_due_days']) ? (int) $data['balance_due_days'] : null,
                'note' => trim((string) ($data['note'] ?? '')) ?: null,
            ];
            $previous = DB::table('catalog_payment_policies')->where('product_id', $product->id)->first();
            $previous
                ? DB::table('catalog_payment_policies')->where('id', $previous->id)->update([...$values, 'updated_by' => $actor->getKey(), 'updated_at' => now()])
                : DB::table('catalog_payment_policies')->insert([...$values, 'product_id' => $product->id, 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);

            $payLater = null;
            if (array_key_exists('pay_later_enabled', $data) && $data['pay_later_enabled'] !== null) {
                $payLater = (bool) $data['pay_later_enabled'];
                if (DB::table('sys_booking_rules')->where('code', 'R-PAY-LATER')->value('product_override')) {
                    $this->writeOverride($product->id, 'R-PAY-LATER', ! $payLater, null, $actor);
                }
            }

            $after = implode(' + ', $modes).($values['deposit_pct'] !== null ? " · adelanto {$values['deposit_pct']} %" : '').($values['balance_due_days'] !== null ? " · saldo {$values['balance_due_days']} días antes" : '').($payLater === null ? '' : ' · pagar después '.($payLater ? 'sí' : 'no'));
            $this->log($product, 'politica_pago', $previous === null ? 'hereda la agencia' : trim((string) $previous->modes, '{}').($previous->deposit_pct !== null ? ' · adelanto '.(int) $previous->deposit_pct.' %' : ''), $after);
        });
    }

    public function resetPayment(string $code, ?int $version, User $actor): int
    {
        return $this->sections->edit($code, $version, $actor, function (object $product): void {
            $previous = DB::table('catalog_payment_policies')->where('product_id', $product->id)->first()
                ?? throw ApiException::unprocessable('CFG-BR-01', 'El producto ya usa la política de pago de la agencia.');
            DB::table('catalog_payment_policies')->where('id', $previous->id)->delete();
            $this->log($product, 'politica_pago', trim((string) $previous->modes, '{}'), 'hereda la agencia');
        });
    }

    public function pickup(string $code, ?int $version, array $data, User $actor): int
    {
        $points = array_values(array_map(fn (mixed $point): array => is_array($point) ? $point : ['label' => (string) $point], $data['points'] ?? []));
        $labels = array_map(fn (array $point): string => mb_strtolower(trim((string) $point['label'])), $points);
        if (count($labels) !== count(array_unique($labels))) {
            throw ApiException::unprocessable('CAT-PK-01', 'Cada punto de recojo debe ser distinto.');
        }
        if ((bool) $data['required'] && $points === []) {
            throw ApiException::unprocessable('CAT-PK-01', 'Si el recojo es obligatorio, agrega al menos un punto.');
        }

        return $this->sections->edit($code, $version, $actor, function (object $product) use ($data, $points, $actor): void {
            $before = DB::table('catalog_pickup_points')->where('product_id', $product->id)->orderBy('sequence')->pluck('label')->all();
            DB::table('catalog_products')->where('id', $product->id)->update(['pickup_required' => (bool) $data['required'], 'pickup_ask_flight' => (bool) ($data['ask_flight'] ?? false)]);
            DB::table('catalog_pickup_points')->where('product_id', $product->id)->delete();
            foreach ($points as $index => $point) {
                $label = trim((string) $point['label']);
                $kind = $point['kind'] ?? self::pickupKind($label);
                DB::table('catalog_pickup_points')->insert([
                    'product_id' => $product->id,
                    'sequence' => $index + 1,
                    'label' => $label,
                    'kind' => $kind,
                    'requires_address' => (bool) ($point['requires_address'] ?? $kind === 'hotel'),
                    'created_by' => $actor->getKey(),
                    'updated_by' => $actor->getKey(),
                ]);
            }
            $describe = fn (bool $required, bool $flight, array $labels): string => ($required ? 'obligatorio' : 'opcional').($flight ? ' · pide vuelo' : '').' · '.(count($labels) ? implode(' | ', $labels) : 'sin puntos');
            $this->log($product, 'recojo', $describe((bool) $product->pickup_required, (bool) $product->pickup_ask_flight, $before), $describe((bool) $data['required'], (bool) ($data['ask_flight'] ?? false), array_map(fn (array $point) => trim((string) $point['label']), $points)));
        });
    }

    public function override(string $code, ?int $version, string $rule, array $data, User $actor): int
    {
        $definition = DB::table('sys_booking_rules')->where('code', $rule)->first(['code', 'params', 'product_override']) ?? throw ApiException::notFound('La regla no existe.');
        if (! $definition->product_override) {
            throw ApiException::unprocessable('CAT-RL-01', 'Esta regla solo se configura para toda la agencia, no por producto (CAT-RL-01).');
        }

        return $this->sections->edit($code, $version, $actor, function (object $product) use ($definition, $data, $actor): void {
            $tenant = (array) json_decode((string) $definition->params, true);
            $existing = DB::table('catalog_product_rule_overrides')->where('product_id', $product->id)->where('rule_code', $definition->code)->first();
            $own = $existing !== null && $existing->params !== null ? (array) json_decode((string) $existing->params, true) : [];
            $disabled = array_key_exists('enabled', $data) && $data['enabled'] !== null ? ! (bool) $data['enabled'] : (bool) ($existing->disabled ?? false);

            if (array_key_exists('params', $data) && is_array($data['params'])) {
                [$clean, $errors] = RuleParams::validate($definition->code, $tenant, [...$tenant, ...$own, ...$data['params']]);
                if ($errors !== []) {
                    throw ValidationException::withMessages(collect($errors)->mapWithKeys(fn (string $message, string $key) => ["params.{$key}" => $message])->all());
                }
                $own = array_filter($clean, fn (mixed $value, string $key): bool => ! array_key_exists($key, $tenant) || $tenant[$key] != $value, ARRAY_FILTER_USE_BOTH);
            }

            $before = $existing === null ? 'usa la agencia' : $this->describeOverride((bool) $existing->disabled, $existing->params === null ? [] : (array) json_decode((string) $existing->params, true));
            $this->writeOverride($product->id, $definition->code, $disabled, $own, $actor);
            $action = array_key_exists('params', $data) && $data['params'] !== null ? 'regla_parametros' : 'regla_producto';
            $this->log($product, $action, "{$definition->code} · {$before}", "{$definition->code} · ".$this->describeOverride($disabled, $own));
        });
    }

    public function resetOverride(string $code, ?int $version, string $rule, User $actor): int
    {
        return $this->sections->edit($code, $version, $actor, function (object $product) use ($rule): void {
            $existing = DB::table('catalog_product_rule_overrides')->where('product_id', $product->id)->where('rule_code', $rule)->first()
                ?? throw ApiException::notFound('El producto no tiene ajustes para esa regla.');
            DB::table('catalog_product_rule_overrides')->where('id', $existing->id)->delete();
            RuleResolver::invalidate($this->context->idOrFail());
            $this->log($product, 'regla_restablecer', "{$rule} · ".$this->describeOverride((bool) $existing->disabled, $existing->params === null ? [] : (array) json_decode((string) $existing->params, true)), "{$rule} · usa la agencia");
        });
    }

    public static function pickupKind(string $label): string
    {
        $text = mb_strtolower($label);

        return match (true) {
            str_contains($text, 'aeropuerto') => 'aeropuerto',
            str_contains($text, 'hotel') => 'hotel',
            str_contains($text, 'terminal') => 'terminal',
            str_contains($text, 'cuenta') => 'por_cuenta',
            default => 'punto_encuentro',
        };
    }

    private function writeOverride(string $productId, string $rule, bool $disabled, ?array $params, User $actor): void
    {
        $existing = DB::table('catalog_product_rule_overrides')->where('product_id', $productId)->where('rule_code', $rule)->first();
        $params ??= $existing !== null && $existing->params !== null ? (array) json_decode((string) $existing->params, true) : [];

        if (! $disabled && $params === []) {
            if ($existing !== null) {
                DB::table('catalog_product_rule_overrides')->where('id', $existing->id)->delete();
            }
        } elseif ($existing !== null) {
            DB::table('catalog_product_rule_overrides')->where('id', $existing->id)->update(['disabled' => $disabled, 'params' => $params === [] ? null : json_encode($params), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        } else {
            DB::table('catalog_product_rule_overrides')->insert(['product_id' => $productId, 'rule_code' => $rule, 'disabled' => $disabled, 'params' => $params === [] ? null : json_encode($params), 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
        }

        RuleResolver::invalidate($this->context->idOrFail());
    }

    private function addonValues(string $productId, array $data): array
    {
        $providerId = $data['provider_id'] ?? null;
        $serviceId = $data['service_id'] ?? null;

        if ($serviceId !== null) {
            $serviceProvider = DB::table('catalog_services')->where('id', $serviceId)->whereNull('deleted_at')->value('provider_id')
                ?? throw ValidationException::withMessages(['service_id' => 'Elige un servicio del catálogo.']);
            if ($providerId !== null && $providerId !== $serviceProvider) {
                throw ApiException::unprocessable('CAT-AD-02', 'El servicio elegido no pertenece a ese proveedor (CAT-AD-02).');
            }
            $providerId = $serviceProvider;
        } elseif ($providerId !== null && ! DB::table('catalog_providers')->where('id', $providerId)->whereNull('deleted_at')->exists()) {
            throw ValidationException::withMessages(['provider_id' => 'Elige un proveedor del catálogo.']);
        }

        $name = trim((string) $data['name']);
        if (DB::table('catalog_product_addons')->where('product_id', $productId)->whereNull('deleted_at')->whereRaw('lower(name) = ?', [mb_strtolower($name)])->when(isset($data['id']), fn ($query) => $query->where('id', '<>', $data['id']))->exists()) {
            throw ApiException::unprocessable('CAT-AD-01', 'Ya hay un adicional con ese nombre en este producto (CAT-AD-01).');
        }

        return [
            'name' => $name,
            'category' => $data['category'],
            'price' => round((float) $data['price'], 2),
            'currency' => $data['currency'],
            'charge_per' => $data['charge_per'],
            'applies_to' => '{'.implode(',', array_values(array_intersect(ProductBookingConfig::PAX_TYPES, (array) $data['applies_to']))).'}',
            'stock_note' => trim((string) ($data['stock_note'] ?? '')) ?: null,
            'provider_id' => $providerId,
            'service_id' => $serviceId,
            'is_optional' => (bool) ($data['is_optional'] ?? true),
        ];
    }

    private function addonInput(object $addon): array
    {
        return [
            'id' => $addon->id,
            'name' => $addon->name,
            'category' => $addon->category,
            'price' => (string) $addon->price,
            'currency' => $addon->currency,
            'charge_per' => $addon->charge_per,
            'applies_to' => explode(',', trim((string) $addon->applies_to, '{}')),
            'stock_note' => $addon->stock_note,
            'provider_id' => $addon->provider_id,
            'service_id' => $addon->service_id,
            'is_optional' => (bool) $addon->is_optional,
        ];
    }

    private function releaseName(string $productId, string $name, ?string $exceptId): void
    {
        DB::table('catalog_product_addons')->where('product_id', $productId)->whereNotNull('deleted_at')->whereRaw('lower(name) = ?', [mb_strtolower($name)])
            ->when($exceptId !== null, fn ($query) => $query->where('id', '<>', $exceptId))
            ->update(['name' => DB::raw("left(name, 120) || ' · ' || code")]);
    }

    private function addon(string $productId, string $addon): object
    {
        return DB::table('catalog_product_addons')->where('product_id', $productId)->whereNull('deleted_at')->where(Str::isUuid($addon) ? 'id' : 'code', $addon)->first()
            ?? throw ApiException::notFound('El adicional no existe.');
    }

    private function leg(string $productId, string $leg): object
    {
        return DB::table('catalog_accommodation_legs')->where('product_id', $productId)->where(Str::isUuid($leg) ? 'id' : 'code', $leg)->first()
            ?? throw ApiException::notFound('El tramo no existe.');
    }

    private function applyOrder(string $productId, array $ids): void
    {
        DB::table('catalog_accommodation_legs')->where('product_id', $productId)->update(['sequence' => DB::raw('sequence + 1000')]);
        foreach (array_values($ids) as $index => $id) {
            DB::table('catalog_accommodation_legs')->where('id', $id)->update(['sequence' => $index + 1]);
        }
    }

    private function ensureHotelName(string $legId, string $name, ?string $exceptId): void
    {
        $exists = DB::table('catalog_accommodation_hotels')->where('leg_id', $legId)->whereRaw('lower(name) = ?', [mb_strtolower(trim($name))])
            ->when($exceptId !== null, fn ($query) => $query->where('id', '<>', $exceptId))->exists();
        if ($exists) {
            throw ApiException::unprocessable('CAT-LG-01', 'Ese hotel ya está en este tramo (CAT-LG-01).');
        }
    }

    private function ensureHotelProvider(?string $providerId): void
    {
        if ($providerId !== null && ! DB::table('catalog_providers')->where('id', $providerId)->where('type', 'Hotel')->whereNull('deleted_at')->exists()) {
            throw ValidationException::withMessages(['provider_id' => 'Elige un proveedor de tipo hotel.']);
        }
    }

    private function ensureHotelsUnused(array $ids): void
    {
        if ($ids !== [] && DB::table('booking_reservation_web_lodging')->whereIn('hotel_id', $ids)->exists()) {
            throw ApiException::conflict('CAT-LG-01', 'Ese hotel ya se vendió en reservas web: quítale los tipos de habitación en lugar de eliminarlo.');
        }
    }

    private function replaceRooms(string $hotelId, array $rooms, User $actor): void
    {
        $types = array_map(fn (array $room): string => $room['room_type'], $rooms);
        if (count($types) !== count(array_unique($types))) {
            throw ApiException::unprocessable('CAT-LG-01', 'Cada tipo de habitación va una sola vez por hotel (CAT-LG-01).');
        }
        DB::table('catalog_accommodation_room_types')->where('hotel_id', $hotelId)->delete();
        foreach ($rooms as $room) {
            DB::table('catalog_accommodation_room_types')->insert(['hotel_id' => $hotelId, 'room_type' => $room['room_type'], 'capacity' => (int) $room['capacity'], 'price_per_night' => round((float) $room['price_per_night'], 2), 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
        }
    }

    private function rooms(string $hotelId): array
    {
        return DB::table('catalog_accommodation_room_types')->where('hotel_id', $hotelId)->orderBy('capacity')->get(['room_type', 'capacity', 'price_per_night'])->map(fn (object $room): array => (array) $room)->all();
    }

    private function describeOperation(mixed $weekdays, mixed $cutoff): string
    {
        $names = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
        $days = is_array($weekdays) ? $weekdays : array_filter(explode(',', trim((string) $weekdays, '{}')), 'is_numeric');
        $labels = array_map(fn (mixed $day): string => $names[(int) $day] ?? (string) $day, $days);

        return (count($labels) === 7 ? 'todos los días' : implode(', ', $labels)).' · '.($cutoff === null ? 'anticipación de la ficha' : "{$cutoff} h de anticipación");
    }

    private function describePax(array $values): string
    {
        return "adulto {$values['adult_min_age']}+ · niño {$values['child_min_age']}–{$values['child_max_age']}".((bool) $values['child_pays'] ? ' al '.(float) $values['child_price_pct'].' %' : ' gratis')
            ." · infante 0–{$values['infant_max_age']}".((bool) $values['infant_allowed'] ? ((bool) $values['infant_pays'] ? ' paga' : ' no paga') : ' no admitido')
            ." · máx. {$values['max_children_per_adult']} niño(s) y {$values['max_infants_per_adult']} infante(s) por adulto · mín. {$values['min_adults']} adulto(s)";
    }

    private function describeAddon(string $code, array $values): string
    {
        $applies = is_array($values['applies_to']) ? implode('/', $values['applies_to']) : trim((string) $values['applies_to'], '{}');

        return "{$code} · {$values['name']} · {$values['currency']} {$values['price']} por {$values['charge_per']} · {$applies}";
    }

    private function describeLodging(string $productId, bool $enabled, bool $optional, ?string $currency): string
    {
        $legs = DB::table('catalog_accommodation_legs')->where('product_id', $productId)->get(['nights']);

        return ($enabled ? 'activo' : 'retirado').' · '.($optional ? 'opcional' : 'incluido').' · '.($currency ?? 'sin moneda').' · '.$legs->count().' ciudades · '.(int) $legs->sum('nights').' noches';
    }

    private function describeHotel(string $city, string $name, string $category, array $rooms): string
    {
        $types = implode(', ', array_map(fn (array $room): string => "{$room['room_type']} ({$room['capacity']}) ".number_format((float) $room['price_per_night'], 2, '.', ''), $rooms));

        return "{$city} · {$name} · {$category} · {$types}";
    }

    private function describeOverride(bool $disabled, array $params): string
    {
        return ($disabled ? 'desactivada para el producto' : 'activa').($params === [] ? '' : ' · '.json_encode($params, JSON_UNESCAPED_UNICODE));
    }

    private function log(object $product, string $action, ?string $before, ?string $after): void
    {
        $this->audit->log('Producto', $product->code, $action, $before === null ? null : mb_substr($before, 0, 500), $after === null ? null : mb_substr($after, 0, 500));
    }
}
