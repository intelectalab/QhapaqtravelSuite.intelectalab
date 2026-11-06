<?php

declare(strict_types=1);

namespace App\Domain\Iam\Http\Controllers;

use App\Domain\Iam\Actions\DisableMfa;
use App\Domain\Iam\Actions\RequestAccess;
use App\Domain\Iam\Models\User;
use App\Domain\Iam\Support\GlobalSearch;
use App\Domain\Iam\Support\TenantProfile;
use App\Domain\Iam\Support\UserNotifications;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class MeController
{
    public function permissions(Request $request): JsonResponse
    {
        $user = $this->user($request);
        $permissions = $user->getAllPermissions()->pluck('name')->sort()->values();

        return response()->json(['data' => ['role' => $user->getRoleNames()->first(), 'permissions' => $permissions], 'meta' => ['total' => $permissions->count()]]);
    }

    public function tenant(Request $request, TenantProfile $profile): JsonResponse
    {
        return response()->json(['data' => $profile->for($this->user($request)->load('sede'))]);
    }

    public function notifications(Request $request, UserNotifications $notifications): JsonResponse
    {
        $result = $notifications->list($this->user($request));

        return response()->json(['data' => $result['items'], 'meta' => ['unread_count' => $result['unread_count'], 'limit' => UserNotifications::LIMIT, 'can_view_log' => $result['can_view_log']]]);
    }

    public function readNotifications(Request $request, UserNotifications $notifications): JsonResponse
    {
        return response()->json(['data' => $notifications->readAll($this->user($request))]);
    }

    public function disableMfa(Request $request, DisableMfa $disable): Response
    {
        $disable($this->user($request));

        return response()->noContent();
    }

    public function search(Request $request, GlobalSearch $search): JsonResponse
    {
        $data = $request->validate(['q' => ['required', 'string', 'min:'.GlobalSearch::MIN, 'max:80']], ['q.*' => 'Escribe al menos '.GlobalSearch::MIN.' caracteres para buscar.']);
        $result = $search->search($this->user($request), $data['q']);

        return response()->json(['data' => $result['items'], 'meta' => ['query' => trim($data['q']), 'limit' => GlobalSearch::LIMIT, 'types' => $result['types'], 'scope' => $result['scope']]]);
    }

    public function requestAccess(Request $request, RequestAccess $access): JsonResponse
    {
        $data = $request->validate(['path' => ['required', 'string', 'max:250', 'regex:/^\//']], ['path.*' => 'Indica la pantalla a la que quieres acceder.']);

        return response()->json(['data' => $access($this->user($request), $data['path'])]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
