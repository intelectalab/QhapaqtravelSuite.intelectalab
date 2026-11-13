<?php

declare(strict_types=1);

namespace App\Domain\Finance\Http\Controllers;

use App\Domain\Finance\Actions\PaymentLinks;
use App\Domain\Finance\Http\Controllers\Concerns\ResolvesActor;
use App\Domain\Finance\Support\GrowthFeatureGate;
use App\Domain\Finance\Support\PaymentLinkDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PaymentLinkController
{
    use ResolvesActor;

    public function index(Request $request, PaymentLinkDirectory $directory, GrowthFeatureGate $gate): JsonResponse
    {
        $gate->require(PaymentLinks::RULE);
        $page = $directory->list($request, $this->actor($request));

        if (str_contains((string) $request->query('include', ''), 'targets')) {
            $page['meta']['targets'] = $directory->targets($this->actor($request));
        }

        return response()->json($page);
    }

    public function store(Request $request, PaymentLinks $links): JsonResponse
    {
        $data = $request->validate(PaymentLinks::rules(), PaymentLinks::messages());

        return response()->json(['data' => $links->create($data, $this->actor($request))], 201);
    }

    public function send(Request $request, string $code, PaymentLinks $links): JsonResponse
    {
        $data = $request->validate([
            'via' => ['required', 'in:email,whatsapp,copia'],
            'to' => ['nullable', 'string', 'max:190'],
        ], ['via.*' => 'Elige cómo enviar el link: correo, WhatsApp o copiar el enlace.', 'to.*' => 'El destino admite hasta 190 caracteres.']);

        return response()->json(['data' => $links->send($code, $data, $this->actor($request))]);
    }

    public function cancel(Request $request, string $code, PaymentLinks $links): JsonResponse
    {
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:300']], ['reason.*' => 'El motivo admite hasta 300 caracteres.']);

        return response()->json(['data' => $links->cancel($code, $data['reason'] ?? null, $this->actor($request))]);
    }
}
