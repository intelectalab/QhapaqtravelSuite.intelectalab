<?php

declare(strict_types=1);

namespace App\Domain\Growth\Recovery;

use App\Domain\Growth\Shared\GrowthRules;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Http\CursorPage;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Sequences\SequenceService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class RecoveryFlows
{
    public const TRIGGERS = ['cart' => 'Carrito abandonado', 'quote' => 'Cotización sin respuesta'];

    public const CHANNELS = ['email' => 'Correo', 'whatsapp' => 'WhatsApp'];

    public const STATUSES = ['programado' => 'Programado', 'enviado' => 'Enviado', 'recuperado' => 'Recuperado', 'descartado' => 'Descartado', 'fallido' => 'Fallido'];

    public const PERMISSION = 'marketing.campaigns.manage';

    private const FIELDS = ['name', 'trigger_kind', 'delay_minutes', 'channel', 'template_ref', 'max_attempts', 'include_payment_link', 'active'];

    public function __construct(
        private readonly GrowthRules $rules,
        private readonly SequenceService $sequences,
        private readonly AuditLogger $audit,
    ) {}

    public function overview(): array
    {
        $stats = DB::table('mkt_recovery_attempts')->groupBy('flow_id')
            ->selectRaw("flow_id, count(*) as attempts, count(*) filter (where status in ('enviado','recuperado')) as sent, count(*) filter (where status = 'recuperado') as recovered, coalesce(sum(recovered_amount), 0) as amount, count(*) filter (where status = 'programado') as scheduled")
            ->get()->keyBy('flow_id');
        $flows = DB::table('mkt_recovery_flows')->orderBy('code')->get()->map(function (object $flow) use ($stats): array {
            $row = $stats->get($flow->id);
            $sent = (int) ($row->sent ?? 0);

            return [
                ...$this->present($flow),
                'stats' => [
                    'attempts' => (int) ($row->attempts ?? 0),
                    'scheduled' => (int) ($row->scheduled ?? 0),
                    'sent' => $sent,
                    'recovered' => (int) ($row->recovered ?? 0),
                    'recovered_amount' => Decimal::toApi((string) ($row->amount ?? '0')),
                    'rate' => $sent > 0 ? round(((int) ($row->recovered ?? 0)) * 100 / $sent, 1) : null,
                ],
            ];
        })->values();

        return [
            'enabled' => $this->rules->enabled('R-CART-RECOVERY'),
            'kpis' => [
                'active' => $flows->where('active', true)->count(),
                'scheduled' => (int) $flows->sum('stats.scheduled'),
                'sent' => (int) $flows->sum('stats.sent'),
                'recovered' => (int) $flows->sum('stats.recovered'),
                'recovered_amount' => Decimal::toApi((string) DB::table('mkt_recovery_attempts')->where('status', 'recuperado')->sum('recovered_amount')),
            ],
            'flows' => $flows->all(),
            'options' => $this->options(),
            'catalogs' => ['triggers' => self::TRIGGERS, 'channels' => self::CHANNELS, 'statuses' => self::STATUSES],
        ];
    }

    public function attempts(Request $request): array
    {
        $filters = CursorPage::filters($request);
        $query = DB::table('mkt_recovery_attempts as a')->join('mkt_recovery_flows as f', 'f.id', '=', 'a.flow_id')
            ->leftJoin('crm_clients as c', 'c.id', '=', 'a.client_id')
            ->leftJoin('channel_web_carts as w', 'w.id', '=', 'a.cart_id')
            ->leftJoin('quote_quotes as q', 'q.id', '=', 'a.quote_id')
            ->leftJoin('booking_reservations as r', 'r.id', '=', 'a.recovered_reservation_id')
            ->when($filters['status'] ?? null, fn ($query, $status) => $query->where('a.status', $status))
            ->when($filters['flow'] ?? null, fn ($query, $flow) => $query->where('f.code', $flow))
            ->select(['a.*', 'f.code as flow_code', 'f.name as flow_name', 'f.channel', 'c.name as client_name', 'w.code as cart_code', 'q.code as quote_code', 'r.code as reservation_code']);
        $counts = DB::table('mkt_recovery_attempts')->groupBy('status')->selectRaw('status, count(*) as total')->pluck('total', 'status')->map(fn ($total): int => (int) $total)->all();

        return CursorPage::respond($request, $query, ['scheduled_at' => 'a.scheduled_at', 'status' => 'a.status'], '-scheduled_at', fn (object $row): array => [
            'id' => (string) $row->id,
            'flow' => ['code' => $row->flow_code, 'name' => $row->flow_name, 'channel' => $row->channel],
            'origin' => $row->cart_code !== null ? ['type' => 'cart', 'label' => 'Carrito', 'code' => $row->cart_code] : ['type' => 'quote', 'label' => 'Cotización', 'code' => $row->quote_code],
            'client' => $row->client_name,
            'to' => $this->mask((string) $row->to_address),
            'attempt_no' => (int) $row->attempt_no,
            'scheduled_at' => $row->scheduled_at,
            'sent_at' => $row->sent_at,
            'status' => $row->status,
            'status_label' => self::STATUSES[$row->status] ?? $row->status,
            'reservation' => $row->reservation_code,
            'recovered_amount' => Decimal::toApi($row->recovered_amount),
        ], ['counts' => $counts, 'statuses' => self::STATUSES]);
    }

    public function create(array $data, User $actor): array
    {
        $this->rules->ensure('R-CART-RECOVERY', self::PERMISSION);
        $data = [...['max_attempts' => 2, 'include_payment_link' => true, 'active' => false], ...$data];
        $this->validate($data);

        return DB::transaction(function () use ($data, $actor): array {
            $code = $this->sequences->next('recovery_flow');
            DB::table('mkt_recovery_flows')->insert([
                'id' => (string) Str::uuid7(),
                'code' => $code,
                ...array_intersect_key($data, array_flip(self::FIELDS)),
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ]);
            $this->audit->log('Flujo de recuperación', $code, 'crear', null, $data['name'].($data['active'] ? ' · activo' : ''));

            return $this->find($code);
        });
    }

    public function update(string $code, array $data, User $actor): array
    {
        $this->rules->ensure('R-CART-RECOVERY', self::PERMISSION);

        return DB::transaction(function () use ($code, $data, $actor): array {
            $flow = DB::table('mkt_recovery_flows')->where('code', $code)->lockForUpdate()->first() ?? throw ApiException::notFound('El flujo de recuperación no existe.');
            $before = array_intersect_key((array) $flow, array_flip(self::FIELDS));
            $after = [...$before, ...array_intersect_key($data, array_flip(self::FIELDS))];
            $this->validate($after);
            $diff = collect($after)->filter(fn ($value, string $field): bool => (string) $value !== (string) $before[$field])->map(fn ($value, string $field): array => ['antes' => $before[$field], 'despues' => $value])->all();

            if ($diff !== []) {
                DB::table('mkt_recovery_flows')->where('id', $flow->id)->update([...$after, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
                $action = array_keys($diff) === ['active'] ? ($after['active'] ? 'activar' : 'pausar') : 'editar';
                $this->audit->log('Flujo de recuperación', $code, $action, $flow->active ? 'activo' : 'inactivo', $after['active'] ? 'activo' : 'inactivo', $diff);
            }

            return $this->find($code);
        });
    }

    private function validate(array $data): void
    {
        if ($data['channel'] === 'email') {
            if (! DB::table('mkt_templates')->where('code', $data['template_ref'])->where('channel', 'email')->exists()) {
                throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige una plantilla de correo de Marketing.', ['field' => 'template_ref']);
            }

            return;
        }

        $status = DB::table('collab_whatsapp_templates')->where('name', $data['template_ref'])->orderByRaw("status = 'aprobada' desc")->value('status');

        if ($status === null) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige una plantilla de WhatsApp registrada.', ['field' => 'template_ref']);
        }

        if ($data['active'] && $status !== 'aprobada') {
            throw ApiException::unprocessable('SC-05', 'Un flujo por WhatsApp solo se activa con una plantilla aprobada por Meta.', ['field' => 'template_ref']);
        }
    }

    private function options(): array
    {
        return [
            'email' => DB::table('mkt_templates')->where('channel', 'email')->orderBy('name')->get(['code', 'name'])->map(fn (object $row): array => ['value' => $row->code, 'label' => $row->name])->all(),
            'whatsapp' => DB::table('collab_whatsapp_templates')->orderBy('name')->get(['name', 'status'])->unique('name')->map(fn (object $row): array => ['value' => $row->name, 'label' => $row->name, 'approved' => $row->status === 'aprobada'])->values()->all(),
        ];
    }

    private function find(string $code): array
    {
        return $this->present(DB::table('mkt_recovery_flows')->where('code', $code)->first() ?? throw ApiException::notFound('El flujo de recuperación no existe.'));
    }

    private function mask(string $address): string
    {
        return str_contains($address, '@') ? Str::mask($address, '*', 2, max(1, strpos($address, '@') - 2)) : Str::mask($address, '*', 0, max(0, mb_strlen($address) - 4));
    }

    private function present(object $flow): array
    {
        return [
            'code' => $flow->code,
            'name' => $flow->name,
            'trigger_kind' => $flow->trigger_kind,
            'trigger_label' => self::TRIGGERS[$flow->trigger_kind] ?? $flow->trigger_kind,
            'delay_minutes' => (int) $flow->delay_minutes,
            'channel' => $flow->channel,
            'channel_label' => self::CHANNELS[$flow->channel] ?? $flow->channel,
            'template_ref' => $flow->template_ref,
            'max_attempts' => (int) $flow->max_attempts,
            'include_payment_link' => (bool) $flow->include_payment_link,
            'active' => (bool) $flow->active,
            'updated_at' => $flow->updated_at,
        ];
    }
}
