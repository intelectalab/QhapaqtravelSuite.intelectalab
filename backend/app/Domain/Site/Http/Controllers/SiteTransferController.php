<?php

declare(strict_types=1);

namespace App\Domain\Site\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Portal\Support\PortalAccount;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Site\Actions\RecreateWebReservation;
use App\Domain\Site\Actions\UploadTransferProof;
use App\Domain\Site\Support\TransferProofs;
use App\Domain\Site\Support\TransferSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class SiteTransferController
{
    public const FILE_RULES = ['required', 'file', 'max:10240'];

    private const FILE_MESSAGES = ['file.required' => 'Elige la foto o el PDF de tu constancia.', 'file.file' => 'Elige la foto o el PDF de tu constancia.', 'file.max' => 'La constancia pesa más de 10 MB.'];

    public function settings(TransferSettings $settings): JsonResponse
    {
        return response()->json(['data' => $settings->overview()]);
    }

    public function updateSettings(Request $request, TransferSettings $settings): JsonResponse
    {
        $data = $request->validate([
            'alert_finance' => ['sometimes', 'boolean'],
            'alert_minutes' => ['sometimes', 'integer', Rule::in(TransferSettings::ALERT_MINUTES)],
            'auto_cancel' => ['sometimes', 'boolean'],
            'cancel_hours' => ['sometimes', 'integer', Rule::in(TransferSettings::CANCEL_HOURS)],
            'reminder_minutes' => ['sometimes', 'integer', Rule::in(TransferSettings::REMINDER_MINUTES)],
            'escalate_minutes' => ['sometimes', 'integer', Rule::in(TransferSettings::ESCALATE_MINUTES)],
            'lock_version' => ['nullable', 'integer', 'min:0'],
        ], [
            'alert_minutes.*' => 'Elige cuándo avisar a Finanzas.',
            'cancel_hours.*' => 'Elige 24, 48 o 72 horas.',
            'reminder_minutes.*' => 'Elige cuándo recordar a Finanzas.',
            'escalate_minutes.*' => 'Elige cuándo escalar a Gerencia.',
            '*.boolean' => 'Indica sí o no.',
        ]);

        return response()->json(['data' => $settings->save($data, $this->user($request), isset($data['lock_version']) ? (int) $data['lock_version'] : null)]);
    }

    public function uploadOrder(Request $request, string $code, UploadTransferProof $upload): JsonResponse
    {
        $data = $request->validate(['file' => self::FILE_RULES, 'operation_ref' => ['nullable', 'string', 'min:4', 'max:60']], [...self::FILE_MESSAGES, 'operation_ref.*' => 'Escribe el número de operación de tu transferencia.']);

        return response()->json(['data' => $upload->forOrder($code, $request->header('X-Order-Token'), $this->file($data), $data['operation_ref'] ?? null)], 201);
    }

    public function uploadAccount(Request $request, string $code, UploadTransferProof $upload): JsonResponse
    {
        $data = $request->validate(['file' => self::FILE_RULES], self::FILE_MESSAGES);
        $account = PortalAccount::of($this->user($request));

        if ($account->isPassenger()) {
            throw ApiException::forbidden('PORTAL_CUSTOMER_ONLY', 'Esta sección es para quien hizo la reserva.', ['portal.view']);
        }

        return response()->json(['data' => $upload->forAccount($account, $code, $this->file($data))], 201);
    }

    public function proof(string $code, TransferProofs $proofs): StreamedResponse
    {
        return $proofs->download($code);
    }

    public function recreation(string $code, RecreateWebReservation $recreate): JsonResponse
    {
        return response()->json(['data' => $recreate->preview($code)]);
    }

    public function recreate(Request $request, string $code, RecreateWebReservation $recreate): JsonResponse
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:300']], ['note.*' => 'La nota admite hasta 300 caracteres.']);

        return response()->json(['data' => $recreate->apply($code, $data['note'] ?? null, $this->user($request))], 201);
    }

    private function file(array $data): UploadedFile
    {
        $file = $data['file'];
        assert($file instanceof UploadedFile);

        return $file;
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
