<?php

declare(strict_types=1);

namespace App\Domain\Admin\Http\Controllers;

use App\Domain\Admin\Actions\UpdateSettings;
use App\Domain\Admin\Support\Branding;
use App\Domain\Admin\Support\SettingsCatalog;
use App\Domain\Admin\Support\SettingsDirectory;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class SettingsController
{
    public function index(Request $request, SettingsDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->user($request))]);
    }

    public function update(Request $request, string $section, UpdateSettings $update): JsonResponse
    {
        [$rules, $messages] = $this->rules($section);
        $data = $request->validate($rules, $messages);

        if ($section === 'channels') {
            $data = collect(SettingsCatalog::CHANNELS)->keys()->mapWithKeys(fn (string $key): array => [$key => $request->boolean($key)])->all();
        }

        if ($section === 'currency') {
            $data['price_with_tax'] = $request->boolean('price_with_tax');
        }

        $expected = $request->input('lock_version');
        $result = $update->section($section, $data, $this->user($request), is_numeric($expected) ? (int) $expected : null);

        $version = $section === 'agency' ? null : DB::table('sys_settings')->where('section', $section)->value('lock_version');

        return response()->json(['data' => ['section' => $section, 'changed' => $result['changed'], 'lock_version' => $version === null ? null : (int) $version], 'meta' => ['warnings' => $result['warnings']]]);
    }

    public function sequences(Request $request, SettingsDirectory $directory): JsonResponse
    {
        return response()->json($directory->sequencePage($request));
    }

    public function storeSequence(Request $request, UpdateSettings $update, SettingsDirectory $directory): JsonResponse
    {
        $data = $request->validate([
            'doc_type' => ['required', 'string', 'max:40'],
            'label' => ['nullable', 'string', 'max:60'],
            'series' => ['nullable', 'string', 'max:10'],
            ...$this->sequenceRules(''),
            'pad_width' => ['nullable', 'integer', 'between:3,10'],
            'year_reset' => ['nullable', 'boolean'],
        ], [...$this->sequenceMessages(''), 'doc_type.*' => 'Elige el tipo de documento.', 'pad_width.*' => 'Los dígitos van de 3 a 10.']);

        return response()->json(['data' => $directory->sequenceById($update->createSequence($data))], 201);
    }

    public function updateSequences(Request $request, UpdateSettings $update, SettingsDirectory $directory): JsonResponse
    {
        $batch = $request->has('sequences') ? 'sequences.*.' : (array_is_list($request->all()) && $request->all() !== [] ? '*.' : '');
        $data = $request->validate([
            ...($batch === 'sequences.*.' ? ['sequences' => ['required', 'array', 'min:1', 'max:30']] : []),
            $batch.'doc_type' => ['required', 'string', 'max:40'],
            $batch.'series' => ['nullable', 'string', 'max:10'],
            ...$this->sequenceRules($batch),
        ], [...$this->sequenceMessages($batch), $batch.'doc_type.*' => 'Indica la serie que cambias.']);
        $items = match ($batch) {
            'sequences.*.' => $data['sequences'],
            '*.' => $data,
            default => [$data],
        };
        $changed = $update->sequences($items);
        $rows = DB::table('sys_sequences')->whereIn('doc_type', $changed)->orderBy('label')->get()->map(fn (object $row): array => SettingsDirectory::sequence($row))->values();

        return response()->json(['data' => $batch === '' ? $rows->first() : $rows, 'meta' => ['changed' => $changed]]);
    }

    public function fxRates(Request $request, SettingsDirectory $directory): JsonResponse
    {
        return response()->json($directory->fxPage($request));
    }

    private function sequenceRules(string $prefix): array
    {
        return [
            $prefix.'prefix' => ['required', 'string', 'max:30', 'regex:/^[A-Z0-9][A-Z0-9-]*$/'],
            $prefix.'next_number' => [$prefix === '' ? 'nullable' : 'required', 'integer', 'min:1', 'max:999999999'],
        ];
    }

    private function sequenceMessages(string $prefix): array
    {
        return [
            $prefix.'prefix.required' => 'El prefijo no puede quedar vacío (CFG-BR-07).',
            $prefix.'prefix.regex' => 'Usa letras mayúsculas, números y guiones.',
            $prefix.'prefix.*' => 'Revisa el prefijo.',
            $prefix.'next_number.*' => 'El próximo número debe ser un entero positivo.',
        ];
    }

    public function branding(Request $request, Branding $branding): JsonResponse
    {
        return response()->json(['data' => $branding->overview($this->user($request))]);
    }

    public function saveBranding(Request $request, Branding $branding): JsonResponse
    {
        $hex = ['required', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'];
        $data = $request->validate([
            'brand' => $hex,
            'accent' => $hex,
            'menu' => $hex,
            'tile_variant' => ['required', 'in:'.implode(',', array_keys(Branding::VARIANTS))],
        ], [
            'brand.*' => 'El color principal debe tener el formato #RRGGBB.',
            'accent.*' => 'El color de acento debe tener el formato #RRGGBB.',
            'menu.*' => 'El color del menú debe tener el formato #RRGGBB.',
            'tile_variant.*' => 'Elige un diseño de tarjeta.',
        ]);
        $data = array_map(fn (string $value): string => str_starts_with($value, '#') ? strtolower($value) : $value, $data);

        return response()->json(['data' => ['changed' => $branding->save($data)]]);
    }

    public function resetBranding(Request $request, Branding $branding): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:200']], ['reason.*' => 'Cuéntanos por qué restableces la apariencia.']);
        $branding->reset($data['reason']);

        return response()->json(['data' => ['reset' => true]]);
    }

    private function rules(string $section): array
    {
        return match ($section) {
            'agency' => [[
                'commercial_name' => ['sometimes', 'required', 'string', 'max:120'],
                'logo_initials' => ['sometimes', 'required', 'string', 'max:3', 'regex:/^[A-Za-zÁÉÍÓÚÑáéíóúñ]{1,3}$/u'],
                'timezone' => ['sometimes', 'required', 'in:'.implode(',', SettingsCatalog::TIMEZONES)],
                'fiscal_address' => ['sometimes', 'required', 'string', 'max:250'],
                'legal_rep' => ['nullable', 'string', 'max:150'],
                'legal_name' => ['prohibited'],
                'ruc' => ['prohibited'],
                'country' => ['prohibited'],
            ], [
                'commercial_name.*' => 'El nombre comercial es obligatorio (CFG-BR-02).',
                'logo_initials.*' => 'Las iniciales del logo son obligatorias: hasta 3 letras (CFG-BR-02).',
                'timezone.*' => 'Elige una zona horaria de la lista.',
                'fiscal_address.*' => 'El domicilio fiscal es obligatorio.',
                'legal_name.prohibited' => 'La razón social la cambia la plataforma, porque requiere validación (CFG-BR-03).',
                'ruc.prohibited' => 'El RUC requiere validación de la plataforma (CFG-BR-03).',
                'country.prohibited' => 'El país requiere validación de la plataforma (CFG-BR-03).',
            ]],
            'general' => [[
                'email' => ['required', 'email', 'max:190'],
                'phone' => ['nullable', 'string', 'max:30'],
                'web' => ['nullable', 'string', 'max:190'],
                'address' => ['required', 'string', 'max:250'],
                'legal_rep' => ['nullable', 'string', 'max:150'],
                'mincetur_registry' => ['nullable', 'string', 'max:120'],
                'lang' => ['required', 'in:'.implode(',', array_keys(SettingsCatalog::LANGS))],
                'date_format' => ['required', 'in:'.implode(',', array_keys(SettingsCatalog::DATE_FORMATS))],
                'main_sede_id' => ['required', 'uuid', 'exists:iam_sedes,id'],
            ], [
                'email.*' => 'Escribe un correo válido.',
                'address.*' => 'El domicilio es obligatorio.',
                'lang.*' => 'Elige un idioma.',
                'date_format.*' => 'Elige un formato de fecha.',
                'main_sede_id.*' => 'Elige una sede activa como principal.',
            ]],
            'currency' => [[
                'base_currency' => ['required', 'in:PEN,USD'],
                'alt_currency' => ['required', 'in:'.implode(',', array_keys(SettingsCatalog::ALT_CURRENCIES))],
                'tax_pct' => ['required', 'integer', 'between:0,30'],
                'fx_source' => ['required', 'in:'.implode(',', SettingsCatalog::FX_SOURCES)],
                'rounding' => ['required', 'in:'.implode(',', array_keys(SettingsCatalog::ROUNDING))],
                'round_mode' => ['required', 'in:'.implode(',', array_keys(SettingsCatalog::ROUND_MODES))],
            ], [
                'base_currency.*' => 'Elige la moneda base.',
                'alt_currency.*' => 'Elige la moneda alterna.',
                'tax_pct.*' => 'El IGV debe estar entre 0 y 30 % (CFG-BR-04).',
                'fx_source.*' => 'Elige la fuente del tipo de cambio.',
                'rounding.*' => 'Elige el redondeo.',
                'round_mode.*' => 'Elige cómo redondear.',
            ]],
            'policies' => [[
                'quote_validity_days' => ['required', 'integer', 'between:1,60'],
                'hold_minutes' => ['required', 'integer', 'between:5,1440'],
                'markup_pct' => ['required', 'integer', 'between:0,300'],
                'max_discount_pct' => ['required', 'integer', 'between:0,30'],
                'approval_margin_pct' => ['required', 'integer', 'between:0,80'],
                'discount_cap_pct' => ['required', 'integer', 'between:0,50', 'gte:max_discount_pct'],
                'advance_pct' => ['required', 'integer', 'between:0,100'],
                'balance_days_before' => ['required', 'integer', 'min:0', 'max:365'],
                'cancel_text' => ['required', 'string', 'max:1000'],
                'modify_text' => ['nullable', 'string', 'max:1000'],
                'noshow_text' => ['nullable', 'string', 'max:1000'],
                'refund_text' => ['nullable', 'string', 'max:1000'],
            ], [
                'quote_validity_days.*' => 'La validez de la cotización va de 1 a 60 días (CFG-BR-09).',
                'hold_minutes.*' => 'El bloqueo de cupos va de 5 a 1 440 minutos (CFG-BR-09).',
                'markup_pct.*' => 'Revisa el margen sugerido.',
                'max_discount_pct.*' => 'El descuento máximo sin aprobación no puede superar el 30 % (CFG-BR-09).',
                'approval_margin_pct.*' => 'El margen mínimo sin aprobación va de 0 a 80 %.',
                'discount_cap_pct.*' => 'El tope de descuento con aprobación va de 0 a 50 % y no puede ser menor que el descuento sin aprobación.',
                'advance_pct.*' => 'El adelanto va de 0 a 100 %.',
                'balance_days_before.*' => 'Indica cuántos días antes vence el saldo.',
                'cancel_text.*' => 'La política de cancelación es obligatoria (CFG-BR-09).',
            ]],
            'operations' => [[
                'voucher_hours_before' => ['required', 'integer', 'min:0', 'max:720'],
                'assign_expiry_min' => ['required', 'integer', 'min:0', 'max:1440'],
                'checkin_tolerance_min' => ['required', 'integer', 'min:0', 'max:240'],
                'modify_min_hours' => ['required', 'integer', 'min:0', 'max:720'],
                'max_pax_per_guide' => ['required', 'integer', 'between:1,40'],
                'offline_sync_min' => ['required', 'integer', 'min:0', 'max:240'],
                'pay_reminder_days' => ['required', 'integer', 'min:0', 'max:60'],
                'trip_notice_hours' => ['required', 'integer', 'min:0', 'max:720'],
                'incident_escalate_min' => ['required', 'integer', 'min:0', 'max:1440'],
            ], [
                'max_pax_per_guide.*' => 'Los pasajeros por guía van de 1 a 40 (CFG-BR-10).',
                '*.required' => 'Completa todos los parámetros operativos (CFG-BR-10).',
                '*.*' => 'Los parámetros operativos son números enteros desde 0 (CFG-BR-10).',
            ]],
            'channels' => [[], []],
            default => throw ApiException::notFound('La sección no existe.'),
        };
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
