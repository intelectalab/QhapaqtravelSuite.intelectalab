<?php

declare(strict_types=1);

namespace App\Domain\Corporate\Actions;

use App\Domain\Admin\Support\StaffNotices;
use App\Domain\Corporate\Support\CorporateDirectory;
use App\Domain\Corporate\Support\CorporateMember;
use App\Domain\Corporate\Support\CorporatePortalRule;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Concurrency\IfMatch;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Sequences\SequenceService;
use Brick\Math\BigDecimal;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CorporateApprovals
{
    public const STATUSES = ['pendiente' => 'Pendiente', 'aprobada' => 'Aprobada', 'rechazada' => 'Rechazada', 'vencida' => 'Vencida', 'cancelada' => 'Cancelada'];

    private const REQUESTABLE = ['enviada', 'vista', 'negociacion', 'aprobada'];

    public function __construct(
        private readonly CorporateDirectory $directory,
        private readonly SequenceService $sequences,
        private readonly AuditLogger $audit,
        private readonly StaffNotices $notices,
    ) {}

    public function request(string $quoteCode, array $data, User $actor): array
    {
        $quote = DB::table('quote_quotes')->where('code', $quoteCode)->whereNull('deleted_at')->first()
            ?? throw Portfolio::missing($actor, 'quote_quotes', $quoteCode, 'La cotización no existe.', 'La cotización');

        if (Portfolio::ownOnly($actor) && $quote->owner_id !== $actor->getKey()) {
            throw ApiException::forbidden('SEC-BR-09', 'La cotización pertenece a la cartera de otro asesor.', ['crm.records.reassign']);
        }

        if (! in_array($quote->status, self::REQUESTABLE, true)) {
            throw ApiException::conflict('CORP_APPROVAL_QUOTE_STATUS', 'Solo se pide aprobación de una cotización enviada al cliente y aún no convertida en reserva.');
        }

        $account = $this->directory->forClient((string) $quote->client_id);

        if ($account === null || $account->status !== 'activa') {
            throw ApiException::unprocessable('CORP_ACCOUNT_REQUIRED', 'El cliente de esta cotización no tiene una cuenta corporativa activa.');
        }

        $version = DB::table('quote_versions')->where('id', $quote->current_version_id)->first(['id', 'version_no', 'grand_total', 'currency', 'created_at'])
            ?? throw ApiException::conflict('RT-3', 'La cotización no tiene una versión vigente.');
        $key = $data['cost_center'] ?? null;
        $center = $key !== null && $key !== '' ? $this->directory->costCenter($account, (string) $key) : ($account->default_cost_center_id ? $this->directory->costCenter($account, (string) $account->default_cost_center_id) : null);

        if ($center === null || ! $center->active) {
            throw ApiException::unprocessable('CORP_APPROVAL_COST_CENTER', 'Elige un centro de costo activo de la empresa para la solicitud.');
        }

        $this->refresh($account);

        if (DB::table('booking_corporate_approvals')->where('quote_id', $quote->id)->where('status', 'pendiente')->exists()) {
            throw ApiException::conflict('CORPORATE_APPROVAL_PENDING', 'Ya hay una solicitud pendiente para esta cotización. Espera la decisión de la empresa.');
        }

        $approval = DB::transaction(function () use ($account, $quote, $version, $center, $actor): object {
            $id = (string) Str::uuid7();
            $code = $this->sequences->next('corporate_approval');
            DB::table('booking_corporate_approvals')->insert([
                'id' => $id,
                'code' => $code,
                'account_id' => $account->id,
                'quote_id' => $quote->id,
                'cost_center_id' => $center->id,
                'amount' => Decimal::toApi((string) $version->grand_total),
                'currency' => $version->currency,
                'requested_by_user_id' => $actor->getKey(),
                'status' => 'pendiente',
                'expires_at' => now()->addHours((int) $account->approval_ttl_hours),
            ]);
            $this->audit->log('Aprobación corporativa', $code, 'solicitar', null, "{$quote->code} v{$version->version_no} · ".Decimal::display((string) $version->grand_total, (string) $version->currency)." · {$center->code}");

            return DB::table('booking_corporate_approvals')->where('id', $id)->first();
        });

        $this->notifyApprovers($account, $approval, (string) $quote->code, (string) $quote->title);

        return $this->present($account, $approval);
    }

    public function list(CorporateMember $member): array
    {
        $this->refresh($member->account);

        return $this->rows($member->account, $member->role() === 'aprobador' ? (string) $member->member->cost_center_id : null)
            ->map(fn (object $row): array => $this->present($member->account, $row, $member))
            ->values()->all();
    }

    public function forAccount(object $account): array
    {
        $this->refresh($account);

        return $this->rows($account, null)->map(fn (object $row): array => $this->present($account, $row))->values()->all();
    }

    public function pendingFor(CorporateMember $member): int
    {
        return DB::table('booking_corporate_approvals')->where('account_id', $member->account->id)->where('status', 'pendiente')->where('expires_at', '>', now())
            ->when($member->role() === 'aprobador', fn ($query) => $query->where('cost_center_id', $member->member->cost_center_id))
            ->count();
    }

    public function decide(CorporateMember $member, string $code, bool $approve, ?string $reason, int $lockVersion): array
    {
        $member->require('approvals', 'Solo el administrador o un aprobador de la empresa deciden las solicitudes.');
        $this->refresh($member->account);
        $approval = DB::table('booking_corporate_approvals')->where('account_id', $member->account->id)->where('code', $code)->lock('for no key update')->first()
            ?? throw ApiException::notFound('No encontramos esa solicitud de aprobación.');

        if ($member->role() === 'aprobador' && $approval->cost_center_id !== $member->member->cost_center_id) {
            throw ApiException::forbidden('CP-07', 'Esta solicitud es de otro centro de costo. Solo la decide su aprobador o el administrador.', ['portal_role:administrador']);
        }

        if ($approval->status !== 'pendiente') {
            throw ApiException::conflict('CP-07', 'La solicitud ya está '.mb_strtolower(self::STATUSES[$approval->status] ?? $approval->status).'. No admite otra decisión.');
        }

        IfMatch::assertMatches($lockVersion, (int) $approval->lock_version, 'La solicitud');
        $reason = $reason === null ? null : (trim($reason) ?: null);

        if (! $approve && $reason === null) {
            throw ApiException::unprocessable('CP-07', 'Escribe el motivo del rechazo para que la agencia pueda ajustar la propuesta.');
        }

        $status = $approve ? 'aprobada' : 'rechazada';

        DB::transaction(function () use ($member, $approval, $status, $reason): void {
            DB::table('booking_corporate_approvals')->where('id', $approval->id)->update([
                'status' => $status,
                'approver_portal_user_id' => $member->id(),
                'decided_at' => now(),
                'reason' => $reason,
            ]);
            $this->audit->log('Aprobación corporativa', (string) $approval->code, $status === 'aprobada' ? 'aprobar' : 'rechazar', 'pendiente', $status.($reason ? " · {$reason}" : '').' · '.$member->member->full_name);
        });

        $fresh = DB::table('booking_corporate_approvals')->where('id', $approval->id)->first();
        [$reference, $title, $owner] = $this->subject($fresh);
        $this->notices->toUser($owner, 'aprobacion_corporativa.decidida', ($status === 'aprobada' ? 'Aprobada' : 'Rechazada')." {$reference} · {$member->account->client_name}", $status === 'aprobada' ? "{$member->member->full_name} aprobó «{$title}». Ya puedes convertirla en reserva." : "{$member->member->full_name} rechazó «{$title}»: {$reason}", 'Aprobación corporativa', (string) $fresh->id);

        return $this->present($member->account, $fresh, $member);
    }

    public function assertConvertible(object $quote, object $version): void
    {
        $account = $this->directory->forClient((string) $quote->client_id);

        if ($account === null || $account->status !== 'activa' || ! $account->require_approval || $account->approval_threshold === null || ! app(CorporatePortalRule::class)->enabled()) {
            return;
        }

        $total = Decimal::convert((string) $version->grand_total, (string) $version->currency, (string) $account->currency, (string) ($version->fx_rate ?: '1'));

        if ($total->compareTo((string) $account->approval_threshold) < 0) {
            return;
        }

        $approved = DB::table('booking_corporate_approvals')->where('quote_id', $quote->id)->where('status', 'aprobada')
            ->where('created_at', '>=', $version->created_at)->exists();

        if (! $approved) {
            throw ApiException::unprocessable('CORPORATE_APPROVAL_REQUIRED', "{$account->client_name} exige la aprobación de la empresa para compras desde ".Decimal::display((string) $account->approval_threshold, (string) $account->currency).'. Pide la aprobación de la versión vigente antes de convertirla en reserva.');
        }
    }

    public function refresh(object $account): void
    {
        $pending = DB::table('booking_corporate_approvals as a')->leftJoin('quote_quotes as q', 'q.id', '=', 'a.quote_id')->leftJoin('quote_versions as v', 'v.id', '=', 'q.current_version_id')
            ->where('a.account_id', $account->id)->where('a.status', 'pendiente')
            ->get(['a.id', 'a.code', 'a.expires_at', 'a.created_at', 'a.quote_id', 'q.status as quote_status', 'q.deleted_at as quote_deleted', 'v.created_at as version_at']);

        foreach ($pending as $row) {
            $status = match (true) {
                $row->quote_id !== null && ($row->quote_deleted !== null || $row->quote_status === 'cancelada' || ($row->version_at !== null && CarbonImmutable::parse((string) $row->version_at)->greaterThan(CarbonImmutable::parse((string) $row->created_at)))) => 'cancelada',
                CarbonImmutable::parse((string) $row->expires_at)->isPast() => 'vencida',
                default => null,
            };

            if ($status !== null) {
                DB::table('booking_corporate_approvals')->where('id', $row->id)->where('status', 'pendiente')->update(['status' => $status]);
                $this->audit->log('Aprobación corporativa', (string) $row->code, $status === 'vencida' ? 'vencer' : 'cancelar', 'pendiente', $status === 'vencida' ? 'vencida sin decisión' : 'cancelada por cambio de la cotización');
            }
        }
    }

    public function present(object $account, object $row, ?CorporateMember $member = null): array
    {
        [$reference, $title, , $kind] = $this->subject($row);
        $center = DB::table('crm_corporate_cost_centers')->where('id', $row->cost_center_id)->first(['code', 'name']);
        $budget = collect($this->directory->costCenters($account))->firstWhere('code', $center?->code);
        $requester = $row->requested_by_portal_user_id
            ? DB::table('crm_corporate_portal_users')->where('id', $row->requested_by_portal_user_id)->value('full_name')
            : ($row->requested_by_user_id ? DB::table('iam_users')->where('id', $row->requested_by_user_id)->value('name') : null);
        $approver = $row->approver_portal_user_id ? DB::table('crm_corporate_portal_users')->where('id', $row->approver_portal_user_id)->value('full_name') : null;
        $exceeds = $budget !== null && $budget['budget_amount'] !== null
            && BigDecimal::of($budget['used'])->plus($row->status === 'pendiente' ? (string) $row->amount : '0')->compareTo($budget['budget_amount']) > 0;

        return [
            'code' => (string) $row->code,
            'kind' => $kind,
            'reference' => $reference,
            'title' => $title,
            'amount' => Decimal::toApi((string) $row->amount),
            'currency' => (string) $row->currency,
            'cost_center' => $center === null ? null : ['code' => (string) $center->code, 'name' => (string) $center->name],
            'budget' => $budget === null ? null : ['amount' => $budget['budget_amount'], 'used' => $budget['used'], 'used_pct' => $budget['used_pct'], 'state' => $budget['budget_state'], 'exceeded' => $exceeds],
            'requested_by' => $requester,
            'approver' => $approver,
            'status' => (string) $row->status,
            'status_label' => self::STATUSES[$row->status] ?? (string) $row->status,
            'reason' => $row->reason,
            'requested_at' => $row->created_at,
            'expires_at' => $row->expires_at,
            'decided_at' => $row->decided_at,
            'lock_version' => (int) $row->lock_version,
            'can_decide' => $member !== null && $row->status === 'pendiente' && $member->can('approvals') && ($member->role() === 'administrador' || $row->cost_center_id === $member->member->cost_center_id),
        ];
    }

    private function rows(object $account, ?string $costCenterId): Collection
    {
        return DB::table('booking_corporate_approvals')->where('account_id', $account->id)
            ->when($costCenterId !== null, fn ($query) => $query->where('cost_center_id', $costCenterId))
            ->orderByRaw("case status when 'pendiente' then 0 else 1 end")->orderByDesc('created_at')->get();
    }

    private function subject(object $row): array
    {
        if ($row->quote_id !== null) {
            $quote = DB::table('quote_quotes')->where('id', $row->quote_id)->first(['code', 'title', 'owner_id']);

            return [(string) ($quote->code ?? '—'), (string) ($quote->title ?? 'Cotización'), $quote?->owner_id ? (string) $quote->owner_id : null, 'cotizacion'];
        }

        $reservation = DB::table('booking_reservations')->where('id', $row->reservation_id)->first(['code', 'title', 'owner_id']);

        return [(string) ($reservation->code ?? '—'), (string) ($reservation->title ?? 'Reserva'), $reservation?->owner_id ? (string) $reservation->owner_id : null, 'reserva'];
    }

    private function notifyApprovers(object $account, object $approval, string $reference, string $title): void
    {
        $recipients = DB::table('crm_corporate_portal_users')->where('account_id', $account->id)->where('status', '<>', 'inactivo')
            ->where(fn ($query) => $query->where('portal_role', 'administrador')->orWhere(fn ($inner) => $inner->where('portal_role', 'aprobador')->where('cost_center_id', $approval->cost_center_id)))
            ->get(['email', 'user_id', 'full_name']);
        $amount = Decimal::display((string) $approval->amount, (string) $approval->currency);
        $subject = "Aprobación pendiente {$approval->code} · {$reference}";
        $body = "La agencia pide aprobar «{$title}» por {$amount}. Decide desde tu portal, en Panel corporativo > Aprobaciones, antes de ".CarbonImmutable::parse((string) $approval->expires_at)->format('d/m/Y H:i').'.';

        $this->notices->toUsers($recipients->pluck('user_id')->filter(), 'aprobacion_corporativa.pendiente', $subject, $body, 'Aprobación corporativa', (string) $approval->id);

        foreach ($recipients as $recipient) {
            $this->notices->email((string) $recipient->email, 'aprobacion_corporativa.pendiente', $subject, "Hola {$recipient->full_name}: {$body}", 'Aprobación corporativa', (string) $approval->id, 'client');
        }
    }
}
