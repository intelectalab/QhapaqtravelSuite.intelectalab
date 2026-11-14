<?php

declare(strict_types=1);

namespace App\Domain\Admin\Http\Controllers;

use App\Domain\Admin\Actions\SaveBusinessHours;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Time\BusinessHours;
use App\Domain\Shared\Time\BusinessSchedule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class BusinessHoursController
{
    public function show(BusinessHours $hours): JsonResponse
    {
        return response()->json(['data' => $hours->overview()]);
    }

    public function update(Request $request, SaveBusinessHours $save): JsonResponse
    {
        $time = ['nullable', 'string', 'regex:'.BusinessSchedule::TIME_PATTERN];
        $rules = ['days' => ['required', 'array'], 'lock_version' => ['nullable', 'integer', 'min:0']];
        $messages = ['days.*' => 'Indica el horario de cada día.', 'lock_version.*' => 'La versión del horario no es válida.'];

        foreach (BusinessSchedule::DAYS as $day) {
            $rules["days.{$day}"] = ['required', 'array'];
            $rules["days.{$day}.open"] = ['required', 'boolean'];
            $rules["days.{$day}.from"] = [...$time, "required_if_accepted:days.{$day}.open"];
            $rules["days.{$day}.to"] = [...$time, "required_if_accepted:days.{$day}.open"];
            $messages["days.{$day}.*"] = 'Escribe la apertura y el cierre con el formato HH:MM.';
        }

        $data = $request->validate($rules, $messages);
        $user = $request->user();
        assert($user instanceof User);

        return response()->json(['data' => $save->save($data['days'], $user, isset($data['lock_version']) ? (int) $data['lock_version'] : null)]);
    }
}
