<?php

declare(strict_types=1);

namespace App\Domain\Mobile\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Mobile\Actions\OperatorActions;
use App\Domain\Mobile\Support\OperatorDirectory;
use App\Domain\Mobile\Support\OperatorResource;
use App\Domain\Operations\Support\IncidentDirectory;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

final class OperatorController
{
    public function registerDevice(Request $request): JsonResponse
    {
        $data = $request->validate([
            'app' => ['nullable', Rule::in(['operador', 'pasajero'])],
            'platform' => ['required', Rule::in(['ios', 'android'])],
            'app_version' => ['required', 'string', 'max:20'],
            'expo_push_token' => ['nullable', 'string', 'max:200'],
        ], [
            'platform.*' => 'Indica la plataforma: ios o android.',
            'app_version.*' => 'Indica la versión de la app.',
            'expo_push_token.*' => 'El token de notificaciones no es válido.',
        ]);
        $user = $this->user($request);
        $id = (string) Str::uuid7();
        DB::table('ops_mobile_devices')->insert([
            'id' => $id,
            'user_id' => $user->getKey(),
            'app' => $data['app'] ?? 'operador',
            'platform' => $data['platform'],
            'app_version' => $data['app_version'],
            'expo_push_token' => $data['expo_push_token'] ?? null,
            'last_seen_at' => now(),
            'created_by' => $user->getKey(),
            'updated_by' => $user->getKey(),
        ]);

        return response()->json(['data' => ['id' => $id]], 201);
    }

    public function revokeDevice(Request $request, string $id): JsonResponse
    {
        $user = $this->user($request);
        $updated = Str::isUuid($id) ? DB::table('ops_mobile_devices')->where('id', $id)->where('user_id', $user->getKey())->whereNull('revoked_at')->update(['revoked_at' => now(), 'updated_by' => $user->getKey(), 'updated_at' => now()]) : 0;

        if ($updated === 0) {
            throw ApiException::notFound('El dispositivo no existe o ya cerró sesión.');
        }

        return response()->json(['data' => ['id' => $id]]);
    }

    public function me(Request $request, OperatorDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->me($this->resource($request))]);
    }

    public function bootstrap(Request $request, OperatorDirectory $directory): JsonResponse
    {
        $data = $request->validate([
            'since' => ['nullable', 'date'],
            'known' => ['nullable', 'array', 'max:200'],
            'known.*' => ['uuid'],
        ], ['since.*' => 'El cursor de sincronización no es válido.', 'known.*' => 'Revisa la lista de asignaciones conocidas.']);
        $resource = $this->resource($request);
        $device = $request->header('X-Device-Id');

        if (is_string($device) && Str::isUuid($device) && DB::table('ops_mobile_devices')->where('id', $device)->where('user_id', $resource->user->getKey())->whereNotNull('revoked_at')->where('updated_by', '<>', $resource->user->getKey())->exists()) {
            throw ApiException::forbidden(OperatorActions::DEVICE_REVOKED, OperatorActions::DEVICE_REVOKED_MESSAGE);
        }

        return response()->json(['data' => $directory->bootstrap($resource, $data['since'] ?? null, $data['known'] ?? [])]);
    }

    public function assignment(Request $request, string $id, OperatorDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->detail($this->resource($request), $id)]);
    }

    public function incidents(Request $request, OperatorDirectory $directory): JsonResponse
    {
        return response()->json(['data' => ['rows' => $directory->incidents($this->resource($request)), 'types' => IncidentDirectory::TYPES, 'severities' => IncidentDirectory::SEVERITIES]]);
    }

    public function action(Request $request, OperatorActions $actions): JsonResponse
    {
        $data = $request->validate($this->rules(''), $this->messages());

        return response()->json(['data' => $actions->handle($this->resource($request), $data)]);
    }

    public function sync(Request $request, OperatorActions $actions): JsonResponse
    {
        $data = $request->validate([
            'actions' => ['required', 'array', 'min:1', 'max:'.OperatorActions::MAX_BATCH],
            ...$this->rules('actions.*.'),
        ], ['actions.*' => 'Envía entre 1 y '.OperatorActions::MAX_BATCH.' acciones.', ...$this->messages()]);

        return response()->json(['data' => $actions->sync($this->resource($request), $data['actions'])]);
    }

    public function storeIncident(Request $request, OperatorActions $actions): JsonResponse
    {
        $data = $request->validate([
            'client_action_id' => ['required', 'uuid'],
            'device_id' => ['required', 'uuid'],
            'assignment_id' => ['required', 'uuid'],
            'occurred_at' => ['required', 'date'],
            'offline' => ['nullable', 'boolean'],
            'type' => ['required', Rule::in(IncidentDirectory::TYPES)],
            'severity' => ['required', Rule::in(IncidentDirectory::SEVERITIES)],
            'title' => ['required', 'string', 'min:3', 'max:200'],
            'description' => ['nullable', 'string', 'max:4000'],
            'upload_ids' => ['nullable', 'array', 'max:10'],
            'upload_ids.*' => ['uuid'],
        ], $this->messages());

        $result = $actions->handle($this->resource($request), [
            'client_action_id' => $data['client_action_id'],
            'device_id' => $data['device_id'],
            'assignment_id' => $data['assignment_id'],
            'occurred_at' => $data['occurred_at'],
            'offline' => $data['offline'] ?? false,
            'type' => 'incident',
            'payload' => collect($data)->only(['type', 'severity', 'title', 'description', 'upload_ids'])->all(),
        ]);

        return response()->json(['data' => $result], $result['result'] === 'rejected' ? 422 : 201);
    }

    private function rules(string $prefix): array
    {
        return [
            "{$prefix}client_action_id" => ['required', 'uuid'],
            "{$prefix}device_id" => ['required', 'uuid'],
            "{$prefix}type" => ['required', Rule::in(OperatorActions::TYPES)],
            "{$prefix}assignment_id" => ['required', 'uuid'],
            "{$prefix}occurred_at" => ['required', 'date'],
            "{$prefix}offline" => ['nullable', 'boolean'],
            "{$prefix}payload" => ['nullable', 'array'],
        ];
    }

    private function messages(): array
    {
        return [
            '*.client_action_id.*' => 'Cada acción necesita un identificador único (UUID).',
            'client_action_id.*' => 'Cada acción necesita un identificador único (UUID).',
            'device_id.*' => 'Registra el dispositivo antes de sincronizar.',
            'type.*' => 'La acción no es válida.',
            'assignment_id.*' => 'Indica la asignación.',
            'occurred_at.*' => 'Indica cuándo ocurrió la acción.',
            'title.*' => 'Escribe un título de al menos 3 caracteres.',
            'severity.*' => 'Elige la severidad.',
        ];
    }

    private function resource(Request $request): OperatorResource
    {
        return OperatorResource::of($this->user($request));
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
