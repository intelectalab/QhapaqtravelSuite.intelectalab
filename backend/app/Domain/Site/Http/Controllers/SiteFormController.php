<?php

declare(strict_types=1);

namespace App\Domain\Site\Http\Controllers;

use App\Domain\Site\Actions\CaptureWebLead;
use App\Domain\Site\Actions\ReceiveWebContact;
use App\Domain\Site\Actions\RegisterWebClaim;
use App\Domain\Site\Actions\SubscribeNewsletter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

final class SiteFormController
{
    private const CONTACT_MESSAGES = [
        'name.*' => 'Escribe tu nombre completo.',
        'email.*' => 'Escribe un correo válido.',
        'phone.*' => 'Escribe un teléfono válido (al menos 7 dígitos).',
        'consent.*' => 'Necesitamos tu autorización para tratar tus datos (Ley 29733).',
    ];

    public function lead(Request $request, CaptureWebLead $capture): JsonResponse
    {
        $undefined = $request->boolean('undefined_dates');
        $minStart = Carbon::today('America/Lima')->addDays(2)->toDateString();
        $data = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:150', 'regex:/\S+\s+\S+/u'],
            'email' => ['required', 'email', 'max:190'],
            'phone' => ['required', 'string', 'regex:/^[0-9+()\s-]{7,20}$/'],
            'country' => ['nullable', 'string', 'max:60'],
            'destinations' => ['required', 'array', 'min:1', 'max:6'],
            'destinations.*' => ['string', 'max:80'],
            'product' => ['nullable', 'string', 'max:160'],
            'start_date' => [$undefined ? 'nullable' : 'required', 'date_format:Y-m-d', 'after_or_equal:'.$minStart],
            'end_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'],
            'flexibility' => ['nullable', 'in:exactas,3_dias,semana,mes'],
            'adults' => ['required', 'integer', 'min:1', 'max:40'],
            'children' => ['nullable', 'integer', 'min:0', 'max:20'],
            'budget' => ['nullable', 'numeric', 'min:0', 'max:100000'],
            'interests' => ['nullable', 'array', 'max:8'],
            'interests.*' => ['string', 'max:40'],
            'hotel' => ['nullable', 'in:economico,turista,superior,lujo,sin_hotel'],
            'service_mode' => ['nullable', 'in:privado,compartido,indistinto'],
            'preferred_contact' => ['nullable', 'in:whatsapp,email,llamada'],
            'comments' => ['nullable', 'string', 'max:1500'],
            'consent' => ['accepted'],
        ], self::CONTACT_MESSAGES + [
            'name.regex' => 'Escribe nombre y apellido.',
            'destinations.*' => 'Elige al menos un destino.',
            'start_date.required' => 'Indica la fecha de inicio o marca que aún no la defines.',
            'start_date.after_or_equal' => 'La fecha de inicio debe ser al menos dentro de 2 días.',
            'start_date.*' => 'La fecha de inicio no es válida.',
            'end_date.after_or_equal' => 'El regreso debe ser igual o posterior al inicio.',
            'end_date.*' => 'La fecha de regreso no es válida.',
            'adults.*' => 'Indica al menos 1 adulto.',
            'children.*' => 'Revisa el número de niños.',
            'budget.*' => 'Revisa el presupuesto.',
            '*' => 'Revisa este dato.',
        ]);

        return response()->json(['data' => $capture->handle($data, 'a_medida')], 201);
    }

    public function contact(Request $request, ReceiveWebContact $contact): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:150'],
            'email' => ['required', 'email', 'max:190'],
            'phone' => ['nullable', 'string', 'regex:/^[0-9+()\s-]{7,20}$/'],
            'reason' => ['required', 'in:'.implode(',', array_keys(ReceiveWebContact::REASONS))],
            'reservation' => ['nullable', 'string', 'max:30'],
            'message' => ['required', 'string', 'min:10', 'max:2000'],
            'consent' => ['accepted'],
        ], self::CONTACT_MESSAGES + [
            'reason.*' => 'Elige el motivo de tu mensaje.',
            'message.*' => 'Cuéntanos tu consulta (al menos 10 caracteres).',
            '*' => 'Revisa este dato.',
        ]);

        return response()->json(['data' => $contact->handle($data)], 201);
    }

    public function newsletter(Request $request, SubscribeNewsletter $subscribe): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:190'],
            'name' => ['nullable', 'string', 'max:150'],
            'consent' => ['accepted'],
        ], self::CONTACT_MESSAGES);

        return response()->json(['data' => $subscribe->handle($data['email'], $data['name'] ?? null)], 201);
    }

    public function claim(Request $request, RegisterWebClaim $register): JsonResponse
    {
        $docRules = match ($request->input('doc_type')) {
            'DNI' => ['regex:/^\d{8}$/'],
            'CE' => ['regex:/^[A-Za-z0-9]{9,12}$/'],
            'RUC' => ['regex:/^(10|15|17|20)\d{9}$/'],
            default => ['regex:/^[A-Za-z0-9]{6,15}$/'],
        };
        $data = $request->validate([
            'name' => ['required', 'string', 'min:5', 'max:150', 'regex:/\S+\s+\S+/u'],
            'doc_type' => ['required', 'in:DNI,CE,Pasaporte,RUC'],
            'doc_number' => ['required', 'string', ...$docRules],
            'email' => ['required', 'email', 'max:190'],
            'phone' => ['required', 'string', 'regex:/^[0-9+()\s-]{7,20}$/'],
            'address' => ['required', 'string', 'min:5', 'max:250'],
            'minor' => ['boolean'],
            'guardian_name' => ['required_if:minor,true', 'nullable', 'string', 'max:150'],
            'guardian_doc' => ['required_if:minor,true', 'nullable', 'string', 'max:20'],
            'sede_id' => ['required', 'uuid'],
            'good_kind' => ['required', 'in:producto,servicio'],
            'good_description' => ['required', 'string', 'min:3', 'max:300'],
            'good_amount' => ['nullable', 'numeric', 'min:0', 'max:1000000'],
            'good_currency' => ['nullable', 'in:PEN,USD'],
            'type' => ['required', 'in:reclamo,queja'],
            'detail' => ['required', 'string', 'min:15', 'max:3000'],
            'request' => ['required', 'string', 'min:5', 'max:1500'],
            'reservation' => ['nullable', 'string', 'max:30'],
            'declaration' => ['accepted'],
        ], [
            'name.*' => 'Escribe nombres y apellidos completos.',
            'doc_type.*' => 'Elige el tipo de documento.',
            'doc_number.*' => 'El número de documento no es válido para el tipo elegido.',
            'email.*' => 'Escribe un correo válido; ahí te enviaremos la constancia.',
            'phone.*' => 'Escribe un teléfono válido.',
            'address.*' => 'Escribe tu domicilio.',
            'guardian_name.*' => 'Escribe el nombre del padre, madre o apoderado.',
            'guardian_doc.*' => 'Escribe el documento del apoderado.',
            'sede_id.*' => 'Elige el establecimiento.',
            'good_kind.*' => 'Indica si es un producto o un servicio.',
            'good_description.*' => 'Describe el producto o servicio contratado.',
            'good_amount.*' => 'Revisa el monto reclamado.',
            'type.*' => 'Elige si es un reclamo o una queja.',
            'detail.*' => 'Detalla lo ocurrido (al menos 15 caracteres).',
            'request.*' => 'Indica qué solicitas a la agencia.',
            'declaration.*' => 'Debes confirmar que la información es verdadera.',
            '*' => 'Revisa este dato.',
        ]);

        return response()->json(['data' => $register->handle($data)], 201);
    }
}
