<?php

declare(strict_types=1);

namespace App\Domain\Operations\Support;

use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class TravelDocChecklist
{
    public const TYPES = ['id_doc', 'visa', 'insurance', 'yellow_fever', 'minor_auth', 'migration', 'emergency', 'special'];

    private const OPEN = ['borrador', 'cancelada'];

    public function __construct(private readonly TravelDocDirectory $directory) {}

    public function sync(string $reservationId): int
    {
        $status = DB::table('booking_reservations')->whereNull('deleted_at')->where('id', $reservationId)->value('status');

        if ($status === null || in_array($status, self::OPEN, true)) {
            return 0;
        }

        $passengers = DB::table('booking_passengers')->where('reservation_id', $reservationId)->pluck('id');
        $existing = DB::table('ops_travel_doc_items')->where('reservation_id', $reservationId)->get(['passenger_id', 'doc_type'])
            ->map(fn (object $item): string => "{$item->passenger_id}:{$item->doc_type}")->flip();
        $rows = [];

        foreach ($passengers as $passengerId) {
            foreach (self::TYPES as $type) {
                if (! $existing->has("{$passengerId}:{$type}")) {
                    $rows[] = ['id' => (string) Str::uuid7(), 'reservation_id' => $reservationId, 'passenger_id' => $passengerId, 'doc_type' => $type, 'status' => 'pendiente'];
                }
            }
        }

        if ($rows !== []) {
            DB::table('ops_travel_doc_items')->insert($rows);
        }

        return count($rows);
    }

    public function assertCanIssue(string $reservationId, string $serviceName): void
    {
        if (preg_match('/'.TravelDocDirectory::NOMINATIVE.'/iu', $serviceName) !== 1) {
            return;
        }

        $this->sync($reservationId);
        $missing = $this->directory->blocking($reservationId);

        if ($missing !== []) {
            $names = collect($missing)->map(fn (array $person): string => $person['name'].' ('.implode(', ', $person['documents']).')')->implode('; ');

            throw ApiException::unprocessable('DOC-BR-010', "No se emite el voucher de una entrada nominativa sin documentos validados: {$names}.");
        }
    }
}
