<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Crm\Support\BusinessDays;
use App\Domain\Crm\Support\ClaimBookDirectory;
use App\Jobs\Concerns\NotifiesStaff;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class AlertClaimDeadlines extends TenantJob
{
    use NotifiesStaff;

    public const QUEUE = 'notifications';

    protected function run(): string
    {
        $today = Carbon::parse($this->today()->toDateString());
        $alertDays = (int) app(ClaimBookDirectory::class)->settings()->alert_days;
        $days = app(BusinessDays::class);
        $claims = DB::table('crm_cases')->where('is_book', true)->whereIn('book_status', ['received', 'in_review'])->whereNotNull('due_date')
            ->orderBy('due_date')->get(['id', 'book_number', 'code', 'owner_id', 'due_date']);
        $managers = $this->managers();
        $late = 0;
        $soon = 0;
        $sent = 0;

        foreach ($claims as $claim) {
            $due = Carbon::parse($claim->due_date);
            $expired = $due->lt($today);

            if (! $expired && $days->between($today, $due) > $alertDays) {
                continue;
            }

            $expired ? $late++ : $soon++;
            $number = $claim->book_number ?? $claim->code;
            $event = $expired ? 'reclamacion.vencida' : 'reclamacion.por_vencer';
            $subject = $expired ? "Reclamo {$number} fuera de plazo" : "Reclamo {$number} por vencer";
            $body = $expired
                ? "El plazo para responder venció el {$due->format('d/m/Y')}. Respóndelo hoy y deja constancia."
                : "Hay que responderlo hasta el {$due->format('d/m/Y')}.";

            foreach (array_unique(array_filter([$claim->owner_id ? (string) $claim->owner_id : null, ...$managers])) as $userId) {
                $sent += $this->notifyOnce($event, $userId, 'crm_case', (string) $claim->id, $subject, $body, true) ? 1 : 0;
            }
        }

        if ($late === 0 && $soon === 0) {
            return 'Todos los reclamos están en plazo';
        }

        $result = self::plural($soon, 'reclamo por vencer', 'reclamos por vencer').' · '.self::plural($late, 'fuera de plazo', 'fuera de plazo').' · '.self::plural($sent, 'aviso', 'avisos');

        return $late > 0 ? $this->warn($result) : $result;
    }
}
