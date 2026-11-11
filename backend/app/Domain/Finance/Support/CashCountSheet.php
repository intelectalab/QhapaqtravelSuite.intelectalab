<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Documents\Support\AgencyLetterhead;
use App\Domain\Documents\Support\DocumentDraft;
use App\Domain\Documents\Support\PdfRenderer;
use App\Domain\Finance\Actions\TreasuryOperations;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class CashCountSheet
{
    private const KIND = ['closing' => 'Cierre de caja', 'surprise' => 'Arqueo sorpresa'];

    private const STATUS = ['signed' => 'Firmado', 'pending_approval' => 'Diferencia por aprobar', 'approved' => 'Diferencia aprobada', 'validated' => 'Validado por contabilidad'];

    private const RESULT = ['balanced' => 'Cuadrado', 'over' => 'Sobrante', 'short' => 'Faltante'];

    public function __construct(private readonly AgencyLetterhead $letterhead, private readonly PdfRenderer $renderer, private readonly AuditLogger $audit) {}

    public function response(string $code): Response
    {
        $count = DB::table('fin_cash_counts as c')->join('fin_treasury_accounts as a', 'a.id', '=', 'c.account_id')->leftJoin('iam_sedes as s', 's.id', '=', 'a.sede_id')
            ->leftJoin('iam_users as signer', 'signer.id', '=', 'c.signed_by')->leftJoin('iam_users as witness', 'witness.id', '=', 'c.witness_id')
            ->leftJoin('iam_users as approver', 'approver.id', '=', 'c.approved_by')->leftJoin('iam_users as validator', 'validator.id', '=', 'c.validated_by')
            ->leftJoin('iam_users as custodian', 'custodian.id', '=', 'a.custodian_id')->leftJoin('fin_cash_sessions as session', 'session.id', '=', 'c.session_id')
            ->where('c.code', $code)
            ->first(['c.*', 'a.code as account_code', 'a.name as account_name', 'a.currency', 'a.fund_amount', 's.name as sede', 'signer.name as signer', 'witness.name as witness_name', 'approver.name as approver', 'validator.name as validator', 'custodian.name as custodian', 'session.code as session_code', 'session.opened_at', 'session.opening_amount'])
            ?? throw ApiException::notFound('El arqueo no existe.');

        $agency = $this->letterhead->current();
        $zone = $agency['timezone'];
        $at = fn (?string $value): ?string => $value ? Carbon::parse($value)->setTimezone($zone)->format('d/m/Y H:i') : null;
        $quantities = (array) json_decode((string) $count->denominations, true);
        $denominations = collect(TreasuryOperations::DENOMINATIONS)->map(fn (string $value): array => [
            'value' => Decimal::display($value, 'PEN'),
            'kind' => (float) $value >= 10 ? 'Billete' : 'Moneda',
            'quantity' => (int) ($quantities[$value] ?? 0),
            'subtotal' => Decimal::display(Decimal::of($value)->multipliedBy((int) ($quantities[$value] ?? 0)), 'PEN'),
        ])->filter(fn (array $row): bool => $row['quantity'] > 0)->values()->all();

        $draft = new DocumentDraft('cash_count', 'fin_cash_count', (string) $count->id, 'finance.cash-count', "Acta {$count->code}", "acta-{$count->code}.pdf", [
            'agency' => $agency,
            'document' => ['kind' => 'Acta de arqueo', 'reference' => $count->code],
            'count' => [
                'code' => $count->code,
                'kind' => self::KIND[$count->kind] ?? $count->kind,
                'status' => self::STATUS[$count->status] ?? $count->status,
                'result' => self::RESULT[$count->result] ?? $count->result,
                'counted_at' => $at($count->counted_at),
                'expected' => Decimal::display((string) $count->expected_amount, 'PEN'),
                'counted' => Decimal::display((string) $count->counted_amount, 'PEN'),
                'difference' => Decimal::display((string) $count->difference, 'PEN'),
                'balanced' => Decimal::of($count->difference)->isZero(),
                'note' => $count->note,
                'approve_note' => $count->approve_note,
            ],
            'account' => ['code' => $count->account_code, 'name' => $count->account_name, 'sede' => $count->sede, 'custodian' => $count->custodian, 'fund' => $count->fund_amount !== null ? Decimal::display((string) $count->fund_amount, 'PEN') : null],
            'session' => $count->session_code ? ['code' => $count->session_code, 'opened_at' => $at($count->opened_at), 'opening' => Decimal::display((string) $count->opening_amount, 'PEN')] : null,
            'denominations' => $denominations,
            'signatures' => array_values(array_filter([
                ['role' => 'Firmó el arqueo', 'name' => $count->signer, 'at' => $at($count->signed_at)],
                ['role' => 'Testigo', 'name' => $count->witness_name, 'at' => null],
                $count->approver ? ['role' => 'Aprobó la diferencia', 'name' => $count->approver, 'at' => $at($count->approved_at)] : null,
                $count->validator ? ['role' => 'Visto bueno contable', 'name' => $count->validator, 'at' => $at($count->validated_at)] : null,
            ])),
        ]);

        $pdf = $this->renderer->render($draft);
        $this->audit->log('Arqueo de caja', $count->code, 'solicitar_pdf', null, (string) $count->status);

        return response($pdf, 200, ['Content-Type' => 'application/pdf', 'Content-Disposition' => "inline; filename=\"{$draft->fileName}\"", 'Cache-Control' => 'private, no-store']);
    }
}
