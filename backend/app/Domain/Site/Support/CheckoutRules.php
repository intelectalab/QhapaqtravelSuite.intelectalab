<?php

declare(strict_types=1);

namespace App\Domain\Site\Support;

use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Validator;

final class CheckoutRules
{
    public const STEPS = ['comprador', 'pasajeros', 'recojo', 'pago'];

    public const DOC_PATTERNS = ['DNI' => '/^\d{8}$/', 'CE' => '/^[A-Za-z0-9]{9,12}$/', 'Pasaporte' => '/^[A-Za-z0-9]{6,15}$/'];

    public static function buyer(array $data): array
    {
        $factura = ($data['billing_type'] ?? null) === 'Factura';

        return Validator::make($data, [
            'name' => ['required', 'string', 'min:5', 'max:150', 'regex:/\S+\s+\S+/u'],
            'email' => ['required', 'email', 'max:190'],
            'phone' => ['required', 'string', 'regex:/^[0-9+()\s-]{7,20}$/'],
            'country' => ['required', 'string', 'max:60'],
            'doc_type' => ['required', 'in:DNI,CE,Pasaporte'],
            'doc_number' => ['required', 'string', 'regex:'.(self::DOC_PATTERNS[$data['doc_type'] ?? 'Pasaporte'] ?? self::DOC_PATTERNS['Pasaporte'])],
            'birth_date' => ['nullable', 'date', 'before:today'],
            'nationality' => ['nullable', 'string', 'max:60'],
            'diet' => ['nullable', 'string', 'max:120'],
            'billing_type' => ['required', 'in:Boleta,Factura'],
            'ruc' => [$factura ? 'required' : 'nullable', 'regex:/^(10|15|17|20)\d{9}$/'],
            'business_name' => [$factura ? 'required' : 'nullable', 'string', 'max:200'],
            'fiscal_address' => [$factura ? 'required' : 'nullable', 'string', 'max:250'],
        ], [
            'name.*' => 'Escribe nombres y apellidos.',
            'email.*' => 'Escribe un correo válido; ahí enviaremos la confirmación.',
            'phone.*' => 'Escribe un celular válido (al menos 7 dígitos).',
            'country.*' => 'Indica tu país.',
            'doc_type.*' => 'Elige el tipo de documento.',
            'doc_number.*' => 'El número de documento no es válido para el tipo elegido.',
            'birth_date.*' => 'La fecha de nacimiento no es válida.',
            'ruc.*' => 'El RUC debe tener 11 dígitos y empezar en 10, 15, 17 o 20.',
            'business_name.*' => 'Escribe la razón social.',
            'fiscal_address.*' => 'Escribe la dirección fiscal.',
        ])->validate();
    }

    public static function passengers(array $data, array $terms): array
    {
        $group = $terms['group'];
        $expected = $group['adt'] + $group['chd'] + $group['inf'];
        $required = $terms['companions']['when'] === 'al_reservar';
        $passengers = array_values((array) ($data['passengers'] ?? []));

        if (! $required && $passengers === []) {
            return [];
        }

        $valid = Validator::make(['passengers' => $passengers], [
            'passengers' => ['required', 'array', "size:{$expected}"],
            'passengers.*.first_name' => ['required', 'string', 'min:2', 'max:80'],
            'passengers.*.last_name' => ['required', 'string', 'min:2', 'max:80'],
            'passengers.*.birth_date' => ['required', 'date', 'before:today'],
            'passengers.*.doc_type' => [$terms['companions']['require_document'] ? 'required' : 'nullable', 'in:DNI,CE,Pasaporte'],
            'passengers.*.doc_number' => [$terms['companions']['require_document'] ? 'required' : 'nullable', 'string', 'max:30'],
            'passengers.*.nationality' => ['required', 'string', 'max:60'],
            'passengers.*.diet' => ['nullable', 'string', 'max:120'],
        ], [
            'passengers.size' => "Completa los datos de los {$expected} viajeros.",
            'passengers.required' => "Completa los datos de los {$expected} viajeros.",
            'passengers.*.first_name.*' => 'Escribe los nombres.',
            'passengers.*.last_name.*' => 'Escribe los apellidos.',
            'passengers.*.birth_date.*' => 'Indica la fecha de nacimiento.',
            'passengers.*.doc_type.*' => 'Elige el documento.',
            'passengers.*.doc_number.*' => 'Escribe el número de documento.',
            'passengers.*.nationality.*' => 'Indica la nacionalidad.',
        ])->validate()['passengers'];

        $first = Carbon::parse($terms['first_date']);
        $minAge = max(array_map(fn (array $item): int => $item['product']['min_age'], $terms['items']) ?: [0]);
        $counts = ['ADT' => 0, 'CHD' => 0, 'INF' => 0];
        $docs = [];
        $errors = [];

        foreach ($valid as $index => $passenger) {
            $age = Carbon::parse($passenger['birth_date'])->diffInYears($first);
            $type = $age >= 12 ? 'ADT' : ($age >= 2 ? 'CHD' : 'INF');
            $valid[$index]['pax_type'] = $type;
            $counts[$type]++;

            if ($age < $minAge && $type !== 'INF') {
                $errors["passengers.{$index}.birth_date"] = ["El servicio exige al menos {$minAge} años a la fecha del viaje."];
            }

            if (! empty($passenger['doc_number'])) {
                $pattern = self::DOC_PATTERNS[$passenger['doc_type'] ?? 'Pasaporte'] ?? self::DOC_PATTERNS['Pasaporte'];
                $doc = strtoupper((string) $passenger['doc_type']).':'.strtoupper((string) $passenger['doc_number']);
                if (preg_match($pattern, (string) $passenger['doc_number']) !== 1) {
                    $errors["passengers.{$index}.doc_number"] = ['El número no es válido para el tipo de documento.'];
                } elseif (isset($docs[$doc])) {
                    $errors["passengers.{$index}.doc_number"] = ['Este documento ya figura en otro viajero.'];
                }
                $docs[$doc] = true;
            }
        }

        if ($errors === [] && ($counts['ADT'] !== $group['adt'] || $counts['CHD'] !== $group['chd'] || $counts['INF'] !== $group['inf'])) {
            $errors['passengers'] = ["Por la edad a la fecha del viaje hay {$counts['ADT']} adultos, {$counts['CHD']} niños y {$counts['INF']} infantes; la reserva es para {$group['adt']}, {$group['chd']} y {$group['inf']}. Revisa las fechas de nacimiento o vuelve al carrito."];
        }

        if ($errors !== []) {
            throw ApiException::unprocessable('SIT-BR-14', (string) array_values($errors)[0][0], $errors);
        }

        return $valid;
    }

    public static function lines(array $data, array $terms): array
    {
        $lines = [];
        $errors = [];

        foreach ($terms['items'] as $item) {
            $input = collect($data['lines'] ?? [])->firstWhere('line', $item['line']) ?? [];
            $values = ['line' => $item['line'], 'pickup_point' => null, 'pickup_address' => null, 'pickup_flight' => null, 'pickup_arrival' => null, 'comments' => null];
            $key = 'lines.'.($item['line'] - 1);

            if ($item['pickup'] !== null) {
                $points = collect($item['pickup']['points']);
                $point = trim((string) ($input['pickup_point'] ?? ''));
                $chosen = $points->firstWhere('label', $point);
                if ($points->isNotEmpty() && $point !== '' && $chosen === null) {
                    $errors["{$key}.pickup_point"] = ['Elige un punto de recojo de la lista.'];
                }
                if ($chosen && $chosen['requires_address'] && trim((string) ($input['pickup_address'] ?? '')) === '') {
                    $errors["{$key}.pickup_address"] = ['Indica el hotel o la dirección.'];
                }
                $flight = strtoupper(trim((string) ($input['pickup_flight'] ?? '')));
                if ($flight !== '' && preg_match('/^[A-Z0-9]{2}\s?\d{1,4}$/', $flight) !== 1) {
                    $errors["{$key}.pickup_flight"] = ['El vuelo se escribe como LA2047.'];
                }
                $values['pickup_point'] = $point !== '' ? mb_substr($point, 0, 200) : null;
                $values['pickup_address'] = trim((string) ($input['pickup_address'] ?? '')) ?: null;
                $values['pickup_flight'] = $flight !== '' ? $flight : null;
                $values['pickup_arrival'] = ! empty($input['pickup_arrival']) ? (string) $input['pickup_arrival'] : null;
            }

            if ($item['comments'] !== null) {
                $comments = trim((string) ($input['comments'] ?? ''));
                if (mb_strlen($comments) > $item['comments']) {
                    $errors["{$key}.comments"] = ["Los comentarios admiten hasta {$item['comments']} caracteres."];
                }
                $values['comments'] = $comments !== '' ? $comments : null;
            }

            $lines[] = $values;
        }

        if ($errors !== []) {
            throw ApiException::unprocessable('VALIDATION_ERROR', (string) array_values($errors)[0][0], $errors);
        }

        return $lines;
    }

    public static function retry(array $data): array
    {
        $method = (string) ($data['method'] ?? 'tarjeta');

        return Validator::make([...$data, 'method' => $method], [
            'method' => ['required', 'in:'.implode(',', array_keys(CheckoutTerms::METHODS))],
            'card_token' => ['nullable', 'regex:/^tok_(ok|51|14)_\d{4}$/'],
            'card_holder' => ['nullable', 'string', 'max:80'],
            'operation_ref' => [$method !== 'tarjeta' ? 'required' : 'nullable', 'string', 'min:4', 'max:40'],
        ], [
            'method.*' => 'Elige el medio de pago.',
            'card_token.*' => 'Revisa los datos de la tarjeta.',
            'operation_ref.*' => 'Escribe el número de operación (al menos 4 caracteres).',
        ])->validate();
    }

    public static function payment(array $data, array $terms): array
    {
        $method = (string) ($data['method'] ?? '');
        $values = Validator::make(['pay_mode' => 'total', ...$data], [
            'pay_mode' => ['required', 'in:'.implode(',', array_column($terms['modes'], 'value'))],
            'method' => ['nullable', 'in:'.implode(',', array_keys(CheckoutTerms::METHODS))],
            'card_token' => [$method === 'tarjeta' ? 'required' : 'nullable', 'regex:/^tok_(ok|51|14)_\d{4}$/'],
            'card_holder' => [$method === 'tarjeta' ? 'required' : 'nullable', 'string', 'min:3', 'max:80'],
            'operation_ref' => [$method !== '' && $method !== 'tarjeta' ? 'required' : 'nullable', 'string', 'min:4', 'max:40'],
            'terms' => ['accepted'],
            'privacy' => ['accepted'],
            'marketing' => ['nullable', 'boolean'],
        ], [
            'pay_mode.*' => 'Elige cómo quieres pagar.',
            'method.*' => 'Elige el medio de pago.',
            'card_token.*' => 'Revisa los datos de la tarjeta.',
            'card_holder.*' => 'Escribe el nombre que figura en la tarjeta.',
            'operation_ref.*' => 'Escribe el número de operación (al menos 4 caracteres).',
            'terms.*' => 'Debes aceptar los términos y las políticas de cancelación.',
            'privacy.*' => 'Debes autorizar el tratamiento de tus datos para gestionar la reserva.',
        ])->validate();

        return $values;
    }
}
