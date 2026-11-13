<?php

declare(strict_types=1);

namespace App\Domain\Admin\Http\Controllers;

use App\Domain\Admin\Actions\PaxMessageScheduler;
use App\Domain\Admin\Support\PaxTemplateDirectory;
use App\Domain\Admin\Support\PgArray;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class PaxTemplatePreviewController
{
    public function __invoke(Request $request, string $id, PaxTemplateDirectory $directory, PaxMessageScheduler $scheduler): JsonResponse
    {
        $data = $request->validate([
            'reservation' => ['nullable', 'string', 'max:30'],
            'channel' => ['nullable', 'in:'.implode(',', array_keys(PaxTemplateDirectory::CHANNELS))],
        ], ['reservation.*' => 'Elige la reserva con la que se previsualiza.', 'channel.*' => 'Elige el canal.']);
        $template = DB::table('notif_pax_message_templates')->where(Str::isUuid($id) ? 'id' : 'code', $id)->first() ?? throw ApiException::notFound('La plantilla no existe.');
        $channels = PgArray::parse($template->channels);
        $channel = $data['channel'] ?? ($channels[0] ?? 'email');

        if (! in_array($channel, $channels, true)) {
            throw ApiException::unprocessable('MSG-01', 'Esa plantilla no usa el canal elegido.');
        }

        $reservation = ($data['reservation'] ?? null) !== null
            ? ($scheduler->reservation($data['reservation']) ?? throw ApiException::notFound('La reserva no existe.'))
            : ($scheduler->firstEligible($template) ?? throw ApiException::unprocessable('MSG-02', 'Ninguna reserva vigente cumple las condiciones de esta plantilla. Elige una reserva para previsualizarla.'));
        $values = $directory->values((string) $reservation->id);
        $plan = $scheduler->explain($template, $reservation);
        preg_match_all('/\{\{\s*([a-z_]+)\s*\}\}/', (string) $template->subject.' '.(string) $template->body, $used);
        $missing = collect($used[1])->unique()->reject(fn (string $key): bool => isset($values[$key]))->values()->all();

        return response()->json(['data' => [
            'code' => $template->code,
            'name' => $template->name,
            'channel' => $channel,
            'lang' => $template->lang,
            'reservation' => $reservation->code,
            'recipient' => $scheduler->recipient($channel, $reservation),
            'subject' => $template->subject ? PaxMessageScheduler::render((string) $template->subject, $values) : null,
            'body' => PaxMessageScheduler::render((string) $template->body, $values),
            'scheduled_at' => $plan['at'],
            'eligible' => $plan['blocked'] === null,
            'blocked_reason' => $plan['blocked'],
            'reservation_lang' => $plan['lang'],
        ], 'meta' => ['missing_variables' => $missing]]);
    }
}
