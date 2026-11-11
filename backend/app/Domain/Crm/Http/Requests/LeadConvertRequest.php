<?php

declare(strict_types=1);

namespace App\Domain\Crm\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class LeadConvertRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'client_mode' => ['nullable', 'in:new,existing'],
            'client_code' => ['required_if:client_mode,existing', 'nullable', 'string'],
            'kind' => ['nullable', 'in:persona,empresa'],
            'name' => ['nullable', 'string', 'max:200'],
            'segment' => ['nullable', 'string', 'max:40'],
            'doc_type' => ['required_without:client_code', 'nullable', 'in:DNI,RUC,PASAPORTE,CE'],
            'doc_number' => ['required_without:client_code', 'nullable', 'string', 'max:20'],
            'country' => ['nullable', 'string', 'max:80'],
            'city' => ['nullable', 'string', 'max:80'],
            'opportunity_title' => ['required', 'string', 'max:200'],
            'stage' => ['nullable', 'in:calificacion,descubrimiento,cotizacion,negociacion'],
            'owner_id' => ['nullable', 'uuid'],
            'schedule_discovery_meeting' => ['boolean'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'currency' => ['required', 'in:PEN,USD'],
            'expected_close_date' => ['required', 'date', 'after_or_equal:today'],
            'lock_version' => ['required', 'integer'],
        ];
    }

    public function messages(): array
    {
        return [
            'client_code.required_if' => 'Elige el cliente al que se vincula.',
            'stage.in' => 'Elige una etapa abierta del embudo.',
            'doc_type.required_without' => 'Elige el tipo de documento del cliente.',
            'doc_number.required_without' => 'Escribe el número de documento del cliente.',
            'opportunity_title.required' => 'Escribe el nombre de la oportunidad.',
            'amount.gt' => 'El monto estimado debe ser mayor que cero.',
            'expected_close_date.after_or_equal' => 'La fecha de cierre no puede ser anterior a hoy.',
        ];
    }
}
