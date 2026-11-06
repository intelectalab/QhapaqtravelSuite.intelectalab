<?php

declare(strict_types=1);

namespace App\Domain\Admin\Http\Controllers;

use App\Domain\Admin\Actions\ManageNotifications;
use App\Domain\Admin\Support\NotificationCatalog;
use App\Domain\Admin\Support\NotificationDirectory;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class NotificationController
{
    public function index(Request $request, NotificationDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->user($request))]);
    }

    public function rule(Request $request, string $event, ManageNotifications $notifications): JsonResponse
    {
        $data = $request->validate([
            'recipients' => ['required', 'string', 'min:3', 'max:200'],
            'timing' => ['required', 'in:'.implode(',', array_keys(NotificationCatalog::TIMINGS))],
            'condition' => ['required', 'in:'.implode(',', array_keys(NotificationCatalog::CONDITIONS))],
        ], [
            'recipients.*' => 'Indica quién recibe el aviso.',
            'timing.*' => 'Elige cuándo se envía.',
            'condition.*' => 'Elige la condición.',
        ]);

        foreach (array_keys(NotificationCatalog::CHANNELS) as $channel) {
            $data[$channel] = $request->boolean($channel);
        }

        $notifications->rule($event, $data, $this->user($request));

        return response()->json(['data' => ['event' => $event]]);
    }

    public function retry(string $code, ManageNotifications $notifications): JsonResponse
    {
        $notifications->retry($code);

        return response()->json(['data' => ['code' => $code]]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
