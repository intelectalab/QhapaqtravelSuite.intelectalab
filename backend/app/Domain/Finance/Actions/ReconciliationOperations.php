<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Finance\Support\BankStatementParser;
use App\Domain\Finance\Support\Consolidation;
use App\Domain\Finance\Support\ReconciliationCandidates;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Sequences\SequenceService;
use Brick\Math\BigDecimal;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

final class ReconciliationOperations
{
    public function __construct(
        private readonly BankStatementParser $parser,
        private readonly ReconciliationCandidates $candidates,
        private readonly SequenceService $sequences,
        private readonly Consolidation $money,
        private readonly AuditLogger $audit,
    ) {}

    public function import(array $data, UploadedFile $file, User $actor): array
    {
        $format = strtolower($file->getClientOriginalExtension());
        $format = in_array($format, BankStatementParser::FORMATS, true) ? $format : 'csv';
        $lines = $this->parser->parse((string) $file->getRealPath(), $format);
        $account = isset($data['bank_account']) ? DB::table('fin_treasury_accounts')->where('code', $data['bank_account'])->where('kind', 'bank')->first(['id', 'bank', 'currency']) : null;

        if (isset($data['bank_account']) && $account === null) {
            throw ApiException::unprocessable('FIN-BR-51', 'Elige una cuenta bancaria de tesorería.');
        }

        $bank = mb_substr((string) ($account->bank ?? $data['bank'] ?? ''), 0, 20);
        if ($bank === '') {
            throw ApiException::unprocessable('FIN-BR-51', 'Indica el banco del extracto.');
        }

        return DB::transaction(function () use ($file, $format, $lines, $account, $bank, $actor): array {
            $statementId = (string) DB::table('fin_bank_statements')->insertGetId([
                'bank' => $bank,
                'bank_account_id' => $account->id ?? null,
                'filename' => mb_substr($file->getClientOriginalName(), 0, 200),
                'format' => $format,
                'lines_count' => count($lines),
                'imported_by' => $actor->getKey(),
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ]);
            $codes = [];

            foreach ($lines as $line) {
                $code = $this->sequences->next('bank_line');
                DB::table('fin_bank_lines')->insert([
                    'code' => $code,
                    'statement_id' => $statementId,
                    'bank' => $bank,
                    'value_date' => $line['date'],
                    'description' => $line['description'],
                    'amount' => $line['amount'],
                    'currency' => $account->currency ?? 'PEN',
                    'status' => 'pendiente',
                    'created_by' => $actor->getKey(),
                    'updated_by' => $actor->getKey(),
                ]);
                $codes[] = $code;
            }

            $this->audit->log('Conciliación', 'EXTRACTO', 'importar', $file->getClientOriginalName(), count($lines)." líneas normalizadas · {$bank}");

            return ['lines' => count($codes), 'codes' => $codes, 'bank' => $bank];
        });
    }

    public function matching(User $actor): array
    {
        return DB::transaction(function () use ($actor): array {
            $pending = DB::table('fin_bank_lines')->where('status', 'pendiente')->whereNull('closure_id')->orderBy('value_date')->orderBy('code')->lockForUpdate()->get();

            if ($pending->isEmpty()) {
                throw ApiException::unprocessable('FIN-BR-51', 'No hay líneas pendientes de matching. Importa un extracto.');
            }

            $suggested = 0;
            foreach ($pending as $line) {
                $match = $this->candidates->best($line);
                DB::table('fin_bank_lines')->where('id', $line->id)->update([
                    'status' => $match ? 'sugerido' : 'excepcion',
                    'matched_payment_id' => $match && $match['kind'] === 'payment' ? $match['id'] : null,
                    'matched_payable_id' => $match && $match['kind'] === 'payable' ? $match['id'] : null,
                    'updated_by' => $actor->getKey(),
                    'updated_at' => now(),
                ]);
                $suggested += $match ? 1 : 0;
            }

            $exceptions = $pending->count() - $suggested;
            $this->audit->log('Conciliación', 'EXTRACTO', 'matching', "{$pending->count()} líneas", "{$suggested} sugeridas · {$exceptions} excepciones");

            return ['lines' => $pending->count(), 'suggested' => $suggested, 'exceptions' => $exceptions];
        });
    }

    public function close(User $actor): array
    {
        return DB::transaction(function () use ($actor): array {
            $open = DB::table('fin_bank_lines')->whereNull('closure_id')->orderBy('code')->lockForUpdate()->get(['id', 'code', 'status', 'amount', 'currency', 'resolution']);

            if ($open->isEmpty()) {
                throw ApiException::unprocessable('FIN-BR-55', 'No hay líneas abiertas para cerrar.');
            }

            $pending = [];
            $ids = [];
            foreach ($open as $line) {
                $ids[] = (string) $line->id;
                if ($line->status !== 'conciliado') {
                    $pending[] = (string) $line->code;
                }
            }

            if ($pending !== []) {
                throw ApiException::unprocessable('FIN-BR-55', 'No se puede cerrar: '.count($pending).' línea(s) sin conciliar ('.implode(', ', array_slice($pending, 0, 8)).'). Resuelve las sugerencias y excepciones primero.');
            }

            $credits = BigDecimal::zero();
            $debits = BigDecimal::zero();
            $matched = 0;
            foreach ($open as $line) {
                $value = $this->money->penExact($line->amount, $line->currency);
                $credits = (float) $line->amount > 0 ? $credits->plus($value) : $credits;
                $debits = (float) $line->amount < 0 ? $debits->plus($value) : $debits;
                $matched += in_array($line->resolution, ['match', 'asignado'], true) ? 1 : 0;
            }
            $code = $this->sequences->next('reconciliation_closure');
            $values = [
                'code' => $code,
                'period' => substr($this->money->today(), 0, 7),
                'closed_by' => $actor->getKey(),
                'lines_count' => $open->count(),
                'credits' => (string) Decimal::round2($credits),
                'debits' => (string) Decimal::round2($debits),
                'net' => (string) Decimal::round2($credits->plus($debits)),
                'matched_count' => $matched,
                'others_count' => $open->count() - $matched,
            ];
            $closureId = (string) DB::table('fin_reconciliation_closures')->insertGetId([...$values, 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
            DB::table('fin_bank_lines')->whereIn('id', $ids)->update(['closure_id' => $closureId, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Conciliación', $code, 'cerrar', "{$open->count()} líneas", "neto S/ {$values['net']}");

            $values['closed_by'] = (string) $actor->name;

            return $values;
        });
    }

    public function closures(): array
    {
        return DB::table('fin_reconciliation_closures as c')
            ->leftJoin('iam_users as u', 'u.id', '=', 'c.closed_by')
            ->orderByDesc('c.closed_at')
            ->get(['c.code', 'c.period', 'c.closed_at', 'c.lines_count', 'c.credits', 'c.debits', 'c.net', 'c.matched_count', 'c.others_count', 'u.name as closed_by'])
            ->map(fn (object $row): array => [...(array) $row, 'credits' => (float) $row->credits, 'debits' => (float) $row->debits, 'net' => (float) $row->net])
            ->all();
    }
}
