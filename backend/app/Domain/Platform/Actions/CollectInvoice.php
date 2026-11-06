<?php

declare(strict_types=1);

namespace App\Domain\Platform\Actions;

use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Platform\Support\LocalGateway;
use App\Domain\Platform\Support\PlatformSequence;
use App\Domain\Platform\Support\PlatformSettings;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CollectInvoice
{
    private const CONNECTION = 'pgsql_platform';

    private const ENTITY = 'Factura plataforma';

    public function __construct(
        private readonly LocalGateway $gateway,
        private readonly PlatformSequence $sequence,
        private readonly PlatformSettings $settings,
        private readonly PlatformSession $session,
        private readonly ChangeTenantStatus $status,
    ) {}

    public function retry(string $id, PlatformUser $actor): array
    {
        return $this->db()->transaction(function () use ($id, $actor): array {
            $invoice = $this->lock($id);

            if (! in_array($invoice->status, ['failed', 'open', 'uncollectible'], true)) {
                throw ApiException::conflict('INVOICE_NOT_COLLECTIBLE', 'Solo se puede reintentar el cobro de una factura pendiente o fallida.');
            }

            $charge = $this->attempt($invoice, 'manual_retry');
            $number = $this->number($invoice);

            if ($charge['result'] === 'succeeded') {
                $this->markPaid($invoice, $charge['method'] ?? 'Tarjeta', $actor);
                $this->session->log(self::ENTITY, $number, 'cobro_exitoso', $invoice->status, 'paid · reintento manual', $actor);
            } else {
                if ($invoice->status === 'open') {
                    $this->startDunning($invoice);
                }
                $this->session->log(self::ENTITY, $number, 'cobro_rechazado', $invoice->status, "reintento manual · {$charge['message']}", $actor);
            }

            return $charge;
        });
    }

    public function manualPayment(string $id, array $data, PlatformUser $actor): void
    {
        $this->db()->transaction(function () use ($id, $data, $actor): void {
            $invoice = $this->lock($id);

            if (! in_array($invoice->status, ['failed', 'open', 'uncollectible'], true)) {
                throw ApiException::conflict('INVOICE_NOT_COLLECTIBLE', 'Esta factura no tiene saldo pendiente.');
            }

            $reference = trim($data['reference']);
            $this->db()->table('payment_attempts')->insert([
                'id' => (string) Str::uuid7(),
                'invoice_id' => $invoice->id,
                'attempt_no' => $this->nextAttempt($invoice->id),
                'source' => 'manual_payment',
                'result' => 'succeeded',
                'gateway_code' => 'manual',
                'message' => mb_substr("{$data['method']} · operación {$reference}", 0, 250),
                'idempotency_key' => 'inv:'.$invoice->id.':manual:'.Str::lower($reference),
                'created_at' => now(),
            ]);
            $this->markPaid($invoice, mb_substr("{$data['method']} · {$reference}", 0, 120), $actor, Carbon::parse($data['paid_on'], 'America/Lima')->setTimeFrom(now('America/Lima'))->utc());
            $this->session->log(self::ENTITY, $this->number($invoice), 'pago_manual', $invoice->status, "paid · {$data['method']} {$reference}", $actor);
        });
    }

    public function void(string $id, string $reason, PlatformUser $actor): string
    {
        return $this->db()->transaction(function () use ($id, $reason, $actor): string {
            $invoice = $this->lock($id);

            if ($invoice->status === 'void') {
                throw ApiException::conflict('INVOICE_VOID', 'La factura ya está anulada.');
            }

            $number = $this->sequence->next(PlatformSequence::CREDIT_NOTE);
            $paid = $invoice->status === 'paid';
            $this->db()->table('platform_credit_notes')->insert([
                'id' => (string) Str::uuid7(),
                'series' => 'NQ01',
                'number' => $number,
                'invoice_id' => $invoice->id,
                'reason' => mb_substr($reason, 0, 300),
                'amount' => $invoice->total,
                'sunat_status' => 'pending',
                'refund_ref' => $paid ? 'Reembolso solicitado a la pasarela' : null,
                'created_by' => $actor->getKey(),
                'created_at' => now(),
            ]);
            $this->db()->table('platform_invoices')->where('id', $invoice->id)->update([
                'status' => 'void',
                'void_reason' => mb_substr($reason, 0, 300),
                'dunning_next_retry_at' => null,
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);
            $note = PlatformSequence::format('NQ01', $number);
            $this->session->log(self::ENTITY, $this->number($invoice), 'anular', $invoice->status, "void · {$note} · {$reason}", $actor);
            $this->settle($invoice, $actor, "Factura {$this->number($invoice)} anulada");

            return $note;
        });
    }

    public function extend(string $id, PlatformUser $actor): void
    {
        $this->db()->transaction(function () use ($id, $actor): void {
            $invoice = $this->lock($id);

            if ($invoice->status !== 'failed') {
                throw ApiException::conflict('DUNNING_INACTIVE', 'Solo las facturas en cobranza admiten prórroga.');
            }

            if ((int) $invoice->dunning_extended_days >= 7) {
                throw ApiException::conflict('DUNNING_EXTENDED', 'Esta factura ya tuvo su prórroga de 7 días.');
            }

            $next = $invoice->dunning_next_retry_at ? Carbon::parse($invoice->dunning_next_retry_at)->addDays(7) : now()->addDays(7);
            $this->db()->table('platform_invoices')->where('id', $invoice->id)->update([
                'dunning_extended_days' => (int) $invoice->dunning_extended_days + 7,
                'dunning_next_retry_at' => $next,
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);
            $this->session->log(self::ENTITY, $this->number($invoice), 'prorroga_dunning', null, 'Próximo reintento '.$next->timezone('America/Lima')->format('d/m/Y H:i'), $actor);
        });
    }

    public function suspendTenant(string $id, string $reason, PlatformUser $actor): void
    {
        $invoice = $this->db()->table('platform_invoices')->where('id', $id)->first() ?? throw ApiException::notFound('La factura no existe.');
        $tenant = Tenant::on(self::CONNECTION)->findOrFail($invoice->tenant_id);
        $this->status->suspend($tenant, $reason, $actor);
        $this->db()->table('subscriptions')->where('id', $invoice->subscription_id)->update(['status' => 'suspended', 'updated_by' => $actor->getKey(), 'updated_at' => now(), 'lock_version' => DB::raw('lock_version + 1')]);
    }

    public function runDunning(PlatformUser $actor): array
    {
        $policy = $this->settings->dunning();
        $due = $this->db()->table('platform_invoices')->where('status', 'failed')->where('dunning_next_retry_at', '<=', now())->pluck('id');
        $summary = ['processed' => 0, 'paid' => 0, 'declined' => 0, 'suspended' => 0];

        foreach ($due as $id) {
            $this->db()->transaction(function () use ($id, $policy, $actor, &$summary): void {
                $invoice = $this->lock((string) $id);
                $charge = $this->attempt($invoice, 'dunning');
                $summary['processed']++;
                $number = $this->number($invoice);

                if ($charge['result'] === 'succeeded') {
                    $summary['paid']++;
                    $this->markPaid($invoice, $charge['method'] ?? 'Tarjeta', $actor);
                    $this->session->log(self::ENTITY, $number, 'cobro_exitoso', 'failed', 'paid · billing:dunning', $actor);

                    return;
                }

                $summary['declined']++;
                $done = (int) $invoice->dunning_retries_done + 1;
                $count = count($policy['retry_days']);
                $failed = Carbon::parse($invoice->dunning_failed_at ?? $invoice->issue_date, 'America/Lima');

                if ($done < $count) {
                    $extra = $done === $count - 1 ? (int) $invoice->dunning_extended_days : 0;
                    $next = $failed->copy()->addDays($policy['retry_days'][$done] + $extra)->setTime(10, 0)->utc();
                    $this->db()->table('platform_invoices')->where('id', $invoice->id)->update(['dunning_retries_done' => $done, 'dunning_next_retry_at' => $next, 'updated_at' => now()]);
                    $this->session->log(self::ENTITY, $number, 'cobro_rechazado', null, "reintento {$done} de {$count} · {$charge['message']}", $actor);

                    return;
                }

                $this->db()->table('platform_invoices')->where('id', $invoice->id)->update(['status' => 'uncollectible', 'dunning_retries_done' => $done, 'dunning_next_retry_at' => null, 'updated_at' => now()]);
                $this->session->log(self::ENTITY, $number, 'cobro_rechazado', 'failed', "uncollectible · último reintento · {$charge['message']}", $actor);
                $tenant = Tenant::on(self::CONNECTION)->find($invoice->tenant_id);

                if ($policy['suspend_after_last'] && $tenant && ! $tenant->isSuspended()) {
                    $this->status->suspend($tenant, "Falta de pago: la factura {$number} agotó los reintentos de cobro.", $actor);
                    $this->db()->table('subscriptions')->where('id', $invoice->subscription_id)->update(['status' => 'suspended', 'updated_at' => now()]);
                    $summary['suspended']++;
                }
            });
        }

        return $summary;
    }

    private function attempt(object $invoice, string $source): array
    {
        $charge = $this->gateway->charge($invoice);
        $attempt = $this->nextAttempt($invoice->id);
        $this->db()->table('payment_attempts')->insert([
            'id' => (string) Str::uuid7(),
            'invoice_id' => $invoice->id,
            'attempt_no' => $attempt,
            'source' => $source,
            'result' => $charge['result'],
            'gateway_code' => $charge['code'],
            'message' => $charge['message'],
            'idempotency_key' => "inv:{$this->number($invoice)}:attempt:{$attempt}",
            'created_at' => now(),
        ]);

        return $charge;
    }

    private function markPaid(object $invoice, string $reference, PlatformUser $actor, ?Carbon $paidAt = null): void
    {
        $this->db()->table('platform_invoices')->where('id', $invoice->id)->update([
            'status' => 'paid',
            'paid_at' => $paidAt ?? now(),
            'payment_ref' => $reference,
            'dunning_next_retry_at' => null,
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);
        $this->settle($invoice, $actor, "Pago de la factura {$this->number($invoice)}");
    }

    private function settle(object $invoice, PlatformUser $actor, string $reason): void
    {
        $debt = $this->db()->table('platform_invoices')->where('tenant_id', $invoice->tenant_id)->whereIn('status', ['failed', 'uncollectible'])->exists();

        if ($debt) {
            return;
        }

        $this->db()->table('subscriptions')->where('id', $invoice->subscription_id)->whereIn('status', ['past_due', 'suspended'])
            ->update(['status' => 'active', 'updated_by' => $actor->getKey(), 'updated_at' => now(), 'lock_version' => DB::raw('lock_version + 1')]);
        $tenant = Tenant::on(self::CONNECTION)->find($invoice->tenant_id);

        if ($tenant?->isSuspended()) {
            $this->status->reactivate($tenant, "{$reason}: sin deuda pendiente.", $actor);
        }
    }

    private function startDunning(object $invoice): void
    {
        $today = Carbon::today('America/Lima');
        $this->db()->table('platform_invoices')->where('id', $invoice->id)->update([
            'status' => 'failed',
            'dunning_failed_at' => $today->toDateString(),
            'dunning_retries_done' => 0,
            'dunning_next_retry_at' => $today->copy()->addDays($this->settings->dunning()['retry_days'][0] ?? 1)->setTime(10, 0)->utc(),
            'updated_at' => now(),
        ]);
        $this->db()->table('subscriptions')->where('id', $invoice->subscription_id)->where('status', 'active')->update(['status' => 'past_due', 'updated_at' => now()]);
    }

    private function nextAttempt(string $invoiceId): int
    {
        return (int) $this->db()->table('payment_attempts')->where('invoice_id', $invoiceId)->max('attempt_no') + 1;
    }

    private function lock(string $id): object
    {
        if (! Str::isUuid($id)) {
            throw ApiException::notFound('La factura no existe.');
        }

        return $this->db()->table('platform_invoices')->where('id', $id)->lockForUpdate()->first() ?? throw ApiException::notFound('La factura no existe.');
    }

    private function number(object $invoice): string
    {
        return PlatformSequence::format(trim((string) $invoice->series), (int) $invoice->number);
    }

    private function db(): ConnectionInterface
    {
        return DB::connection(self::CONNECTION);
    }
}
