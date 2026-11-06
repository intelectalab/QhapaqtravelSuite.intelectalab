<?php

declare(strict_types=1);

namespace App\Domain\Operations\Actions;

use App\Domain\Iam\Models\User;
use App\Domain\Operations\Support\TravelDocDirectory;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class TravelDocWorkflow
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function validate(string $id, array $data, User $actor): void
    {
        $item = $this->item($id);

        if ($item->doc_type === 'id_doc' && blank($data['doc_number'] ?? $item->doc_number)) {
            throw ApiException::unprocessable('DOC-BR-001', 'Registra el número del documento antes de validarlo.');
        }

        if (! empty($data['expiry_date']) && $data['expiry_date'] < $item->travel_to) {
            throw ApiException::unprocessable('DOC-BR-002', 'El documento vence antes de que termine el viaje.');
        }

        DB::table('ops_travel_doc_items')->where('id', $item->id)->update([
            'status' => 'completo',
            'doc_number' => $data['doc_number'] ?? $item->doc_number,
            'expiry_date' => $data['expiry_date'] ?? $item->expiry_date,
            'observation' => null,
            'validated_by' => $actor->getKey(),
            'validated_at' => now(),
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);
        $this->audit->log('Documento de viaje', "{$item->reservation_code} · {$item->full_name}", 'validar', $item->status, TravelDocDirectory::LABELS[$item->doc_type] ?? $item->doc_type);
    }

    public function observe(string $id, string $reason, User $actor): void
    {
        $item = $this->item($id);
        DB::table('ops_travel_doc_items')->where('id', $item->id)->update(['status' => 'observado', 'observation' => $reason, 'validated_by' => null, 'validated_at' => null, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Documento de viaje', "{$item->reservation_code} · {$item->full_name}", 'observar', $item->status, $reason);
    }

    private function item(string $id): object
    {
        if (! Str::isUuid($id)) {
            throw ApiException::notFound('El documento no existe.');
        }

        return DB::table('ops_travel_doc_items as i')->join('booking_reservations as r', 'r.id', '=', 'i.reservation_id')->join('booking_passengers as p', 'p.id', '=', 'i.passenger_id')
            ->where('i.id', $id)->first(['i.*', 'r.code as reservation_code', 'r.travel_to', 'p.full_name']) ?? throw ApiException::notFound('El documento no existe.');
    }
}
