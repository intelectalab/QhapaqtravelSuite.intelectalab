<?php

declare(strict_types=1);

namespace App\Domain\Channels\Actions;

use App\Domain\Channels\Support\ChannelKit;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use Illuminate\Support\Facades\DB;

final class ManageB2bAgency
{
    public function __construct(private readonly AuditLogger $audit, private readonly ChannelKit $kit) {}

    public function create(array $data, User $actor): string
    {
        $this->assertUniqueRuc($data['ruc']);
        $code = $this->kit->nextCode('channel_b2b_agencies', 'AGB-', 2);

        DB::table('channel_b2b_agencies')->insert([
            ...$this->fields($data),
            'code' => $code,
            'credit_used' => 0,
            'status' => 'activa',
            'created_by' => $actor->getKey(),
            'updated_by' => $actor->getKey(),
        ]);

        $this->audit->log('Agencia B2B', $code, 'crear', null, "{$data['legal_name']} · {$data['commission_pct']} %");

        return $code;
    }

    public function update(string $code, array $data, User $actor): void
    {
        $row = $this->kit->row('channel_b2b_agencies', $code);
        $this->assertUniqueRuc($data['ruc'], $row->id);

        $limit = Decimal::money($data['credit_limit'] ?? 0);

        if ($limit->isPositive() && $limit->isLessThan(Decimal::money($row->credit_used))) {
            throw ApiException::unprocessable('B2B-BR-03', 'La línea de crédito no puede quedar por debajo del crédito ya utilizado.');
        }

        DB::table('channel_b2b_agencies')->where('id', $row->id)->update([
            ...$this->fields($data),
            'lock_version' => $row->lock_version + 1,
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);

        $this->audit->log('Agencia B2B', $code, 'editar', "{$row->commission_pct} % · {$row->credit_limit}", "{$data['commission_pct']} % · {$limit}");
    }

    public function setStatus(string $code, string $status, ?string $reason, User $actor): void
    {
        $row = $this->kit->row('channel_b2b_agencies', $code);

        if ($row->status === $status) {
            throw ApiException::conflict('B2B-BR-05', 'La agencia ya está en ese estado.');
        }

        if ($status === 'activa' && (float) $row->credit_limit > 0 && (float) $row->credit_used > (float) $row->credit_limit) {
            throw ApiException::conflict('B2B-BR-04', 'No se puede reactivar: el crédito utilizado supera la línea. Registra un pago o amplía la línea primero.');
        }

        DB::table('channel_b2b_agencies')->where('id', $row->id)->update([
            'status' => $status,
            'block_reason' => $status === 'bloqueada' ? 'manual' : null,
            'lock_version' => $row->lock_version + 1,
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);

        $this->audit->log('Agencia B2B', $code, match ($status) {
            'activa' => $row->status === 'bloqueada' ? 'desbloquear' : 'activar',
            'bloqueada' => 'bloquear',
            default => 'desactivar',
        }, $row->status, trim($status.($reason ? " · {$reason}" : '')));
    }

    private function fields(array $data): array
    {
        return [
            'legal_name' => $data['legal_name'],
            'ruc' => $data['ruc'],
            'contact_name' => $data['contact_name'],
            'booking_email' => $data['booking_email'] ?? null,
            'crm_client_id' => isset($data['client']) ? DB::table('crm_clients')->where('code', $data['client'])->value('id') : null,
            'price_list_id' => $data['price_list_id'],
            'commission_pct' => $data['commission_pct'],
            'credit_currency' => $data['currency'],
            'credit_limit' => $data['credit_limit'] ?? 0,
            'valid_from' => $data['valid_from'],
            'valid_to' => $data['valid_to'],
        ];
    }

    private function assertUniqueRuc(string $ruc, ?string $except = null): void
    {
        $taken = DB::table('channel_b2b_agencies')->where('ruc', $ruc)->whereNull('deleted_at')->when($except, fn ($query) => $query->where('id', '<>', $except))->exists();

        if ($taken) {
            throw ApiException::conflict('B2B-BR-01', 'Ya existe una agencia con ese RUC.');
        }
    }
}
