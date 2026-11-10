<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Actions;

use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Iam\Models\User;
use App\Domain\Inbox\Support\ApprovalInbox;
use App\Domain\Inbox\Support\ApprovalRules;
use App\Domain\Inbox\Support\OriginClosure;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ApprovalWorkflow
{
    public function __construct(
        private readonly ApprovalRules $rules,
        private readonly CodeSequence $codes,
        private readonly AuditLogger $audit,
    ) {}

    public function create(array $data, User $actor): string
    {
        $fx = $this->fx($data['currency']);
        $amountPen = round((float) $data['amount'] * $fx, 2);
        $type = $data['type'];

        if ($this->rules->rule($type, 1) === null) {
            throw ApiException::unprocessable('APR-BR-15', 'Ese tipo de solicitud no tiene una regla activa de nivel 1.');
        }

        return DB::transaction(function () use ($data, $actor, $fx, $amountPen, $type): string {
            $code = $this->codes->next('collab_approval_requests', 'APR-'.Carbon::now()->year.'-');
            $id = (string) Str::uuid7();

            DB::table('collab_approval_requests')->insert([
                'id' => $id,
                'code' => $code,
                'request_type' => $type,
                'is_generic' => true,
                'subject_code' => $data['reference'] ?? null,
                'dedupe_key' => "{$type}:{$code}",
                'title' => $data['title'],
                'justification' => $data['justification'],
                'requester_id' => $actor->getKey(),
                'requester_kind' => 'user',
                'amount' => $data['amount'],
                'currency' => $data['currency'],
                'fx_rate' => $fx,
                'status' => 'pendiente',
                'current_level' => 1,
                'total_levels' => $this->rules->levels($type, $amountPen),
                'due_at' => Carbon::now()->addHours($this->rules->sla($type, 1)),
                'closed_in_origin' => false,
                'created_by' => $actor->getKey(),
            ]);
            $this->event($id, 'creada', $actor, $data['justification']);
            $this->audit->log('Aprobación', $code, 'crear', null, "{$data['title']} · {$data['currency']} {$data['amount']}");

            return $code;
        });
    }

    public function update(string $code, array $data, User $actor): void
    {
        $request = $this->open($code);

        if ($request->requester_id !== $actor->getKey() || ! $request->is_generic) {
            throw ApiException::forbidden('APR-BR-03', 'Solo quien creó la solicitud puede editarla.');
        }

        $fx = $this->fx($data['currency']);
        DB::table('collab_approval_requests')->where('id', $request->id)->update([
            'title' => $data['title'],
            'justification' => $data['justification'],
            'subject_code' => $data['reference'] ?? null,
            'amount' => $data['amount'],
            'currency' => $data['currency'],
            'fx_rate' => $fx,
            'total_levels' => max((int) $request->current_level, $this->rules->levels($request->request_type, round((float) $data['amount'] * $fx, 2))),
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);
        $this->audit->log('Aprobación', $code, 'editar', "{$request->currency} {$request->amount}", "{$data['currency']} {$data['amount']}");
    }

    public function withdraw(string $code, ?string $note, User $actor): void
    {
        $request = $this->open($code);

        if ($request->requester_id !== $actor->getKey()) {
            throw ApiException::forbidden('APR-BR-03', 'Solo quien pidió la aprobación puede retirarla.');
        }

        DB::transaction(function () use ($request, $note, $actor): void {
            DB::table('collab_approval_requests')->where('id', $request->id)->update(['status' => 'anulada', 'decided_at' => now(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->event($request->id, 'retirada', $actor, $note ?: 'Solicitud retirada');
            $this->audit->log('Aprobación', $request->code, 'retirar', $request->status, 'anulada');
        });
    }

    public function decide(string $code, bool $approve, ?string $note, User $actor): string
    {
        $request = $this->open($code);
        $level = (int) $request->current_level;
        $rule = $this->rules->rule($request->request_type, $level) ?? throw ApiException::conflict('APR-BR-15', 'No hay una regla activa para este nivel.');

        if (! $actor->can($rule->permission)) {
            throw ApiException::forbidden('APR-BR-04', 'Tu rol no aprueba este nivel.', [$rule->permission]);
        }

        if ($rule->forbid_self_approval && $request->requester_id === $actor->getKey()) {
            throw ApiException::forbidden('APR-BR-03', 'No puedes aprobar tu propia solicitud.');
        }

        if (DB::table('collab_approval_steps')->where('request_id', $request->id)->where('decided_by', $actor->getKey())->exists()) {
            throw ApiException::forbidden('APR-BR-03', 'Ya decidiste un nivel anterior de esta solicitud.');
        }

        if (! $approve && trim((string) $note) === '') {
            throw ApiException::unprocessable('APR-BR-07', 'Explica por qué se rechaza.');
        }

        return DB::transaction(function () use ($request, $approve, $note, $actor, $level, $rule): string {
            $updated = DB::table('collab_approval_requests')->where('id', $request->id)->where('lock_version', $request->lock_version)->update(['lock_version' => $request->lock_version + 1]);
            if ($updated === 0) {
                throw ApiException::conflict('APR-BR-08', 'Otra persona acaba de decidir esta solicitud. Actualiza la bandeja.');
            }

            DB::table('collab_approval_steps')->insert([
                'id' => (string) Str::uuid7(),
                'request_id' => $request->id,
                'level' => $level,
                'rule_id' => $rule->id,
                'decision' => $approve ? 'aprobada' : 'rechazada',
                'decided_by' => $actor->getKey(),
                'note' => $note,
                'decided_at' => now(),
                'created_by' => $actor->getKey(),
            ]);

            $final = ! $approve || $level >= (int) $request->total_levels;
            $status = $approve ? ($final ? 'aprobada' : 'pendiente') : 'rechazada';
            $values = $final
                ? ['status' => $status, 'decided_by' => $actor->getKey(), 'decided_at' => now(), 'decision_note' => $note, 'delegated_to' => null]
                : ['current_level' => $level + 1, 'due_at' => Carbon::now()->addHours($this->rules->sla($request->request_type, $level + 1)), 'delegated_to' => null];

            DB::table('collab_approval_requests')->where('id', $request->id)->update([...$values, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->event($request->id, $approve ? ($final ? 'aprobada' : 'aprobada_nivel') : 'rechazada', $actor, $note);
            $this->audit->log('Aprobación', $request->code, $approve ? ($final ? 'aprobar' : "aprobar_nivel_{$level}") : 'rechazar', $request->status, $status);

            return $status;
        });
    }

    public function updateRule(string $code, array $data, User $actor): void
    {
        $rule = DB::table('collab_approval_rules')->whereNull('deleted_at')->where('code', $code)->first() ?? throw ApiException::notFound('La regla no existe.');

        if (! $data['active'] && (int) $rule->level === 1 && DB::table('collab_approval_rules')->whereNull('deleted_at')->where('request_type', $rule->request_type)->where('level', 1)->where('is_active', true)->where('id', '<>', $rule->id)->doesntExist()) {
            throw ApiException::unprocessable('APR-BR-15', 'Cada tipo necesita al menos una regla activa de nivel 1.');
        }

        $values = [
            'min_amount_pen' => $data['min_amount'],
            'sla_hours' => $data['sla_hours'],
            'is_active' => $data['active'],
            'forbid_self_approval' => $data['forbid_self'],
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ];

        if (! $rule->is_origin_locked && isset($data['permission'])) {
            $values['permission'] = $data['permission'];
        }

        DB::table('collab_approval_rules')->where('id', $rule->id)->update($values);
        $this->rules->forget();
        $this->audit->log('Regla de aprobación', $code, 'editar', "{$rule->permission} · S/ {$rule->min_amount_pen} · {$rule->sla_hours} h", ($values['permission'] ?? $rule->permission)." · S/ {$data['min_amount']} · {$data['sla_hours']} h");
    }

    private function open(string $code): object
    {
        $request = DB::table('collab_approval_requests')->where('code', $code)->first() ?? throw ApiException::notFound('La solicitud no existe.');

        if (! in_array($request->status, ['pendiente', 'info'], true)) {
            throw ApiException::conflict('APR-BR-08', 'La solicitud ya fue resuelta.');
        }

        if (! array_key_exists($request->request_type, ApprovalInbox::TYPES)) {
            throw ApiException::notFound('La solicitud no existe.');
        }

        if (in_array($request->subject_type, OriginClosure::MIRRORED, true)) {
            throw ApiException::conflict('APR-BR-12', "Esta solicitud se decide sobre su origen ({$request->subject_code}).");
        }

        return $request;
    }

    private function fx(string $currency): float
    {
        return $currency === 'PEN' ? 1.0 : (float) (DB::table('fin_fx_rates')->where('currency_code', $currency)->orderByDesc('rate_date')->orderByDesc('effective_at')->value('rate_pen') ?? 1);
    }

    private function event(string $requestId, string $event, User $actor, ?string $note): void
    {
        DB::table('collab_approval_events')->insert([
            'id' => (string) Str::uuid7(),
            'request_id' => $requestId,
            'event' => $event,
            'actor_id' => $actor->getKey(),
            'note' => $note,
            'occurred_at' => now(),
        ]);
    }
}
