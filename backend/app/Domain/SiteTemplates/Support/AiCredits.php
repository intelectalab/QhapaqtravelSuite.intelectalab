<?php

declare(strict_types=1);

namespace App\Domain\SiteTemplates\Support;

use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

final class AiCredits
{
    public const KINDS = ['contenido' => 'Contenido', 'imagenes' => 'Imágenes'];

    public const COSTS = ['meta_seo' => 1, 'mejorar_texto' => 2, 'traducir' => 3, 'relato_aventura' => 4, 'articulo' => 8, 'imagen' => 1, 'imagen_hd' => 2];

    public const PLAN_INCLUDED = ['starter' => 0, 'professional' => 50, 'enterprise' => 100];

    public const PLAN_ADDON = 'ai_content';

    public const PLAN_IMAGE_BONUS = ['IA-PRO' => 30];

    public const MOVEMENTS = ['asignacion_plan' => 'Asignación del plan', 'compra_paquete' => 'Compra', 'consumo' => 'Consumo', 'reembolso' => 'Reembolso', 'vencimiento' => 'Vencimiento', 'ajuste' => 'Ajuste'];

    public const LOW_RATIO = 0.2;

    public function __construct(private readonly TenantContext $context, private readonly TemplateCatalog $catalog) {}

    public function balance(string $kind): int
    {
        return (int) (DB::table('fin_ai_credit_ledger')->where('kind', $kind)->orderByDesc('occurred_at')->orderByDesc('id')->value('balance_after') ?? 0);
    }

    public function ensure(string $kind, int $needed): void
    {
        $balance = $this->balance($kind);

        if ($balance < $needed) {
            throw new ApiException(429, 'AI_CREDITS_EXHAUSTED', 'AI_CREDITS_EXHAUSTED', 'No tiene créditos de '.mb_strtolower(self::KINDS[$kind]).' suficientes: este pedido usa '.$needed.' y su saldo es '.$balance.'. Compre un paquete para continuar.', [], ['kind' => $kind, 'needed' => $needed, 'balance' => $balance, 'packs' => $this->packs()->where('kind', $kind)->pluck('code')->values()->all()]);
        }
    }

    public function append(string $kind, string $movement, int $credits, ?string $packId = null, ?string $jobId = null, ?string $note = null, ?string $userId = null): int
    {
        DB::select('select pg_advisory_xact_lock(hashtext(?))', [$this->context->idOrFail().':ai-credits:'.$kind]);
        $balance = $this->balance($kind) + $credits;

        if ($balance < 0) {
            $this->ensure($kind, -$credits);
        }

        DB::table('fin_ai_credit_ledger')->insert([
            'id' => (string) Str::uuid7(),
            'kind' => $kind,
            'movement' => $movement,
            'credits' => $credits,
            'balance_after' => $balance,
            'pack_id' => $packId,
            'job_id' => $jobId,
            'note' => $note !== null ? mb_substr($note, 0, 200) : null,
            'occurred_at' => now()->utc(),
            'created_by' => $userId,
        ]);

        return $balance;
    }

    public function packs(bool $onlyActive = true): Collection
    {
        return $this->catalog->db()->table('platform_ai_credit_packs')->when($onlyActive, fn ($query) => $query->where('active', true))->orderBy('billing')->orderBy('kind')->orderBy('price')->get();
    }

    public function pack(string $code): stdClass
    {
        $pack = $this->catalog->db()->table('platform_ai_credit_packs')->where('code', $code)->first();

        if ($pack === null) {
            throw ApiException::notFound('Ese paquete de créditos no existe.');
        }

        return $pack;
    }

    public function isPlan(stdClass $pack): bool
    {
        return $pack->billing === 'mensual' && $pack->addon_code === self::PLAN_ADDON;
    }

    public function contractedPlan(): ?stdClass
    {
        $plans = $this->packs(false)->filter(fn (stdClass $pack): bool => $this->isPlan($pack))->keyBy('id');

        if ($plans->isEmpty()) {
            return null;
        }

        $last = DB::table('fin_ai_credit_ledger')->whereIn('pack_id', $plans->keys()->all())->whereIn('movement', ['compra_paquete', 'asignacion_plan'])->orderByDesc('occurred_at')->orderByDesc('id')->value('pack_id');

        return $last !== null ? $plans->get($last) : null;
    }

    public function included(): int
    {
        $plan = $this->catalog->tenantPlan($this->context->idOrFail());

        return self::PLAN_INCLUDED[$plan->code ?? ''] ?? 0;
    }

    public function summary(): array
    {
        $plan = $this->contractedPlan();
        $monthStart = Carbon::now($this->context->timezone())->startOfMonth()->utc();
        $usage = DB::table('fin_ai_credit_ledger')->where('movement', 'consumo')->where('occurred_at', '>=', $monthStart)->groupBy('kind')->selectRaw('kind, -sum(credits) as used')->pluck('used', 'kind');
        $granted = DB::table('fin_ai_credit_ledger')->where('credits', '>', 0)->where('occurred_at', '>=', $monthStart)->groupBy('kind')->selectRaw('kind, sum(credits) as granted')->pluck('granted', 'kind');
        $balances = [];

        foreach (array_keys(self::KINDS) as $kind) {
            $balance = $this->balance($kind);
            $used = (int) ($usage[$kind] ?? 0);
            $available = $balance + $used;
            $balances[$kind] = ['balance' => $balance, 'used_month' => $used, 'granted_month' => (int) ($granted[$kind] ?? 0), 'low' => $available > 0 && $balance <= $available * self::LOW_RATIO];
        }

        return [
            'balances' => $balances,
            'plan_included' => ['contenido' => $this->included(), 'imagenes' => 0],
            'ai_plan' => $plan !== null ? $this->presentPack($plan) : null,
            'costs' => self::COSTS,
        ];
    }

    public function ledger(int $limit = 200): array
    {
        $rows = DB::table('fin_ai_credit_ledger')->orderByDesc('occurred_at')->orderByDesc('id')->limit($limit)->get();
        $packs = $this->packs(false)->keyBy('id');
        $jobs = DB::table('cms_ai_content_jobs')->whereIn('id', $rows->pluck('job_id')->filter()->all())->pluck('code', 'id');

        return $rows->map(fn (stdClass $row): array => [
            'id' => $row->id,
            'kind' => $row->kind,
            'kind_label' => self::KINDS[$row->kind],
            'movement' => $row->movement,
            'movement_label' => self::MOVEMENTS[$row->movement] ?? $row->movement,
            'credits' => (int) $row->credits,
            'balance_after' => (int) $row->balance_after,
            'pack' => $row->pack_id !== null && $packs->has($row->pack_id) ? $packs->get($row->pack_id)->code : null,
            'job' => $row->job_id !== null ? ($jobs[$row->job_id] ?? null) : null,
            'note' => $row->note,
            'occurred_at' => Carbon::parse($row->occurred_at)->toIso8601String(),
        ])->all();
    }

    public function presentPack(stdClass $pack): array
    {
        return [
            'code' => $pack->code,
            'name' => $pack->name,
            'kind' => $pack->kind,
            'kind_label' => self::KINDS[$pack->kind],
            'credits' => (int) $pack->credits,
            'image_bonus' => self::PLAN_IMAGE_BONUS[$pack->code] ?? 0,
            'price' => number_format((float) $pack->price, 2, '.', ''),
            'currency' => $pack->currency,
            'billing' => $pack->billing,
            'addon_code' => $pack->addon_code,
            'is_plan' => $this->isPlan($pack),
            'active' => (bool) $pack->active,
        ];
    }
}
