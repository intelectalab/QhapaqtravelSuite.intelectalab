<?php

declare(strict_types=1);

namespace App\Domain\Corporate\Actions;

use App\Domain\Admin\Support\PgArray;
use App\Domain\Admin\Support\StaffNotices;
use App\Domain\Corporate\Support\CorporateDirectory;
use App\Domain\Corporate\Support\CorporateLedger;
use App\Domain\Corporate\Support\CorporateMember;
use App\Domain\Corporate\Support\CorporatePeriod;
use App\Domain\Corporate\Support\CorporateStatementSheet;
use App\Domain\Documents\Support\DocumentStore;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use Brick\Math\BigDecimal;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CorporateStatements
{
    public const STATUSES = ['generado' => 'Generado', 'enviado' => 'Enviado', 'anulado' => 'Anulado'];

    public function __construct(
        private readonly CorporateDirectory $directory,
        private readonly CorporateLedger $ledger,
        private readonly AuditLogger $audit,
        private readonly StaffNotices $notices,
        private readonly DocumentStore $documents,
        private readonly CorporateStatementSheet $sheet,
    ) {}

    public function generate(object $account, string $month, ?User $actor, array $history = []): object
    {
        if (preg_match('/^(\d{4})-(0[1-9]|1[0-2])$/', $month, $m) !== 1) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'Indica el mes en formato AAAA-MM.');
        }

        $period = CorporatePeriod::month((int) $m[1], (int) $m[2]);

        if ($period->from > $this->directory->today()->toDateString()) {
            throw ApiException::unprocessable('CP-05', 'No se genera el estado de cuenta de un mes que aún no empieza.');
        }

        if (DB::table('fin_corporate_statements')->where('account_id', $account->id)->where('period_start', $period->from)->where('currency', $account->currency)->where('status', '<>', 'anulado')->exists()) {
            throw ApiException::conflict('CP-05', "Ya existe el estado de cuenta de {$period->label}. Anúlalo si necesitas regenerarlo.");
        }

        $this->ledger->forget((string) $account->id);
        $entries = $this->entries($account, $history);
        $lines = $entries->filter(fn (array $row): bool => $period->contains($row['date']))->values();
        $opening = $entries->filter(fn (array $row): bool => $row['date'] < $period->from)
            ->reduce(fn (BigDecimal $sum, array $row): BigDecimal => $sum->plus($row['charge'])->minus($row['credit']), BigDecimal::zero())->toScale(2);
        $charges = $this->sum($lines, 'charge');
        $payments = $this->sum($lines->where('kind', 'pago'), 'credit');
        $credits = $this->sum($lines->where('kind', 'nota_credito'), 'credit');
        $closing = $opening->plus($charges)->minus($payments)->minus($credits);

        return DB::transaction(function () use ($account, $period, $lines, $opening, $charges, $payments, $credits, $closing, $actor): object {
            $code = $this->code($account, $period);
            $id = (string) Str::uuid7();
            DB::table('fin_corporate_statements')->insert([
                'id' => $id,
                'code' => $code,
                'account_id' => $account->id,
                'period_start' => $period->from,
                'period_end' => $period->to,
                'currency' => $account->currency,
                'opening_balance' => (string) $opening,
                'charges' => (string) $charges,
                'payments' => (string) $payments,
                'credits' => (string) $credits,
                'closing_balance' => (string) $closing,
                'lines' => json_encode($lines->map(fn (array $row): array => array_diff_key($row, ['balance' => true]))->all(), JSON_UNESCAPED_UNICODE),
                'status' => 'generado',
                'generated_by' => $actor?->getKey(),
                'generated_at' => now(),
            ]);
            $this->audit->log('Estado de cuenta corporativo', $code, 'generar', null, "{$period->label} · saldo final ".Decimal::display($closing, (string) $account->currency), actor: $actor);
            $this->ledger->forget((string) $account->id);

            return DB::table('fin_corporate_statements')->where('id', $id)->first();
        });
    }

    public function send(object $statement, ?array $recipients, ?User $actor): object
    {
        if ($statement->status === 'anulado') {
            throw ApiException::conflict('CORP_STATEMENT_VOID', 'El estado de cuenta está anulado. Genera uno nuevo para enviarlo.');
        }

        $account = $this->directory->reload((string) $statement->account_id);
        $to = array_values(array_unique(array_filter(array_map(fn (mixed $email): string => Str::lower(trim((string) $email)), $recipients ?? PgArray::parse($account->statement_recipients)))));

        if ($to === []) {
            throw ApiException::unprocessable('CORP_RECIPIENTS_REQUIRED', 'La cuenta no tiene correos de destino para el estado de cuenta. Agrégalos en la configuración del envío.');
        }

        foreach ($to as $email) {
            if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
                throw ApiException::unprocessable('VALIDATION_ERROR', "El correo {$email} no es válido.");
            }
        }

        $document = $this->documents->store($this->sheet->draft($statement));
        $label = $this->label($statement);

        DB::transaction(function () use ($statement, $account, $to, $document, $label, $actor): void {
            DB::table('fin_corporate_statements')->where('id', $statement->id)->update(['status' => 'enviado', 'sent_at' => now(), 'sent_to' => PgArray::from($to), 'document_id' => $document->id]);
            DB::table('crm_corporate_accounts')->where('id', $account->id)->update(['statement_last_sent_at' => now()]);
            $this->audit->log('Estado de cuenta corporativo', (string) $statement->code, 'enviar', (string) $statement->status, implode(', ', $to), actor: $actor);

            foreach ($to as $email) {
                $this->notices->email($email, 'estado_cuenta.corporativo', "Estado de cuenta {$label} · {$account->client_name}", "Adjuntamos el estado de cuenta de {$label}: saldo inicial ".Decimal::display((string) $statement->opening_balance, (string) $statement->currency).', compras '.Decimal::display((string) $statement->charges, (string) $statement->currency).', pagos '.Decimal::display((string) $statement->payments, (string) $statement->currency).' y saldo final '.Decimal::display((string) $statement->closing_balance, (string) $statement->currency).'. También lo encuentras en tu portal, en Panel corporativo > Estado de cuenta.', 'Estado de cuenta corporativo', (string) $statement->id, 'client');
            }
        });

        return DB::table('fin_corporate_statements')->where('id', $statement->id)->first();
    }

    public function void(object $statement, ?string $reason, User $actor): object
    {
        if ($statement->status === 'anulado') {
            throw ApiException::conflict('CORP_STATEMENT_VOID', 'El estado de cuenta ya está anulado.');
        }

        DB::transaction(function () use ($statement, $reason, $actor): void {
            DB::table('fin_corporate_statements')->where('id', $statement->id)->update(['status' => 'anulado']);
            $this->audit->log('Estado de cuenta corporativo', (string) $statement->code, 'anular', (string) $statement->status, 'anulado'.($reason ? " · {$reason}" : ''), actor: $actor);
        });

        return DB::table('fin_corporate_statements')->where('id', $statement->id)->first();
    }

    public function settings(CorporateMember $member, array $data, int $lockVersion): array
    {
        $member->require('statements.manage', 'Solo el administrador o el pagador de la empresa configuran el envío del estado de cuenta.');
        $account = $this->directory->reload((string) $member->account->id);
        app(CorporateAccounts::class)->update($account, array_intersect_key($data, array_flip(['statement_auto', 'statement_day', 'statement_recipients'])), $lockVersion);

        return $this->settingsView($this->directory->reload((string) $account->id));
    }

    public function settingsView(object $account): array
    {
        return [
            'statement_auto' => (bool) $account->statement_auto,
            'statement_day' => (int) $account->statement_day,
            'statement_recipients' => PgArray::parse($account->statement_recipients),
            'statement_last_sent_at' => $account->statement_last_sent_at,
            'lock_version' => (int) $account->lock_version,
        ];
    }

    public function pdf(object $statement, Request $request): Response|JsonResponse
    {
        $document = $this->documents->store($this->sheet->draft($statement));

        if ($statement->document_id !== $document->id) {
            DB::table('fin_corporate_statements')->where('id', $statement->id)->update(['document_id' => $document->id]);
        }

        return $this->documents->respond($document, $request);
    }

    public function runAutomatic(?CarbonImmutable $today = null): array
    {
        $today ??= $this->directory->today();
        $month = $today->subMonthNoOverflow()->format('Y-m');
        $sent = [];

        $accounts = $this->directory->query()->where('a.status', 'activa')->where('a.statement_auto', true)->where('a.statement_day', $today->day)->get();

        foreach ($accounts as $account) {
            $existing = DB::table('fin_corporate_statements')->where('account_id', $account->id)->where('period_start', $today->subMonthNoOverflow()->startOfMonth()->toDateString())->where('currency', $account->currency)->where('status', '<>', 'anulado')->first();
            $statement = $existing ?? $this->generate($account, $month, null);

            if ($statement->status === 'generado') {
                $statement = $this->send($statement, null, null);
            }

            $sent[] = (string) $statement->code;
        }

        return $sent;
    }

    public function find(string $code, ?object $account = null): object
    {
        $statement = DB::table('fin_corporate_statements')->where('code', $code)->when($account !== null, fn ($query) => $query->where('account_id', $account->id))->first();

        return $statement ?? throw ApiException::notFound('No encontramos ese estado de cuenta.');
    }

    public function present(object $statement, bool $withLines = false): array
    {
        $account = DB::table('crm_corporate_accounts as a')->join('crm_clients as c', 'c.id', '=', 'a.client_id')->where('a.id', $statement->account_id)->first(['a.id', 'c.code', 'c.name']);
        $data = [
            'code' => (string) $statement->code,
            'account' => ['id' => (string) $statement->account_id, 'client_code' => (string) ($account->code ?? ''), 'client_name' => (string) ($account->name ?? '')],
            'month' => substr((string) $statement->period_start, 0, 7),
            'label' => $this->label($statement),
            'period_start' => (string) $statement->period_start,
            'period_end' => (string) $statement->period_end,
            'currency' => (string) $statement->currency,
            'opening_balance' => Decimal::toApi((string) $statement->opening_balance),
            'charges' => Decimal::toApi((string) $statement->charges),
            'payments' => Decimal::toApi((string) $statement->payments),
            'credits' => Decimal::toApi((string) $statement->credits),
            'closing_balance' => Decimal::toApi((string) $statement->closing_balance),
            'status' => (string) $statement->status,
            'status_label' => self::STATUSES[$statement->status] ?? (string) $statement->status,
            'generated_at' => $statement->generated_at,
            'sent_at' => $statement->sent_at,
            'sent_to' => PgArray::parse($statement->sent_to),
            'has_pdf' => $statement->document_id !== null,
            'lines_count' => count((array) json_decode((string) $statement->lines, true)),
        ];

        if ($withLines) {
            $data['lines'] = array_map(fn (array $line): array => [
                'id' => (string) ($line['id'] ?? ''),
                'date' => (string) ($line['date'] ?? ''),
                'kind' => (string) ($line['kind'] ?? ''),
                'kind_label' => CorporateLedger::KINDS[$line['kind'] ?? ''] ?? (string) ($line['kind'] ?? ''),
                'document' => (string) ($line['document'] ?? ''),
                'detail' => (string) ($line['detail'] ?? ''),
                'cost_center' => $line['cost_center'] ?? null,
                'charge' => Decimal::toApi((string) ($line['charge'] ?? '0')),
                'credit' => Decimal::toApi((string) ($line['credit'] ?? '0')),
            ], array_values(array_filter((array) json_decode((string) $statement->lines, true), 'is_array')));
        }

        return $data;
    }

    public function label(object $statement): string
    {
        $start = CarbonImmutable::parse((string) $statement->period_start);

        return ucfirst(CorporatePeriod::MONTHS[$start->month - 1]).' '.$start->year;
    }

    private function entries(object $account, array $history): Collection
    {
        $entries = $this->ledger->entries($account);

        if ($history === []) {
            return $entries;
        }

        $known = $entries->keyBy('id');

        foreach ($history as $line) {
            if (! $known->has($line['id'])) {
                $known->put($line['id'], [...$line, 'origin' => CorporateLedger::ORIGIN_HISTORY]);
            }
        }

        return $known->values()->sort(fn (array $a, array $b): int => [$a['date'], $a['kind'] === 'compra' ? 0 : 1, $a['id']] <=> [$b['date'], $b['kind'] === 'compra' ? 0 : 1, $b['id']])->values();
    }

    private function code(object $account, CorporatePeriod $period): string
    {
        $base = 'EC-'.mb_substr(str_replace('-', '', (string) $account->client_code), 0, 7).'-'.$period->key;
        $code = $base;
        $attempt = 1;

        while (DB::table('fin_corporate_statements')->where('code', $code)->exists()) {
            $attempt++;
            $code = $base.'-'.$attempt;
        }

        return $code;
    }

    private function sum(Collection $rows, string $field): BigDecimal
    {
        return $rows->reduce(fn (BigDecimal $sum, array $row): BigDecimal => $sum->plus((string) $row[$field]), BigDecimal::zero())->toScale(2);
    }
}
