<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Actions;

use App\Domain\Admin\Support\StaffNotices;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Finance\Actions\PaymentWorkflow;
use App\Domain\Iam\Models\User;
use App\Domain\Inbox\Support\ApprovalInbox;
use App\Domain\Inbox\Support\ApprovalRules;
use App\Domain\Inbox\Support\OriginClosure;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Sequences\SequenceService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ApprovalWorkflow
{
    public function __construct(
        private readonly ApprovalRules $rules,
        private readonly CodeSequence $codes,
        private readonly AuditLogger $audit,
        private readonly PaymentWorkflow $payments,
    ) {}

    public function create(array $data, User $actor): string
    {
        $fx = $this->fx($data['currency']);
        $amountPen = round((float) $data['amount'] * $fx, 2);
        $type = $data['type'];

        if ($this->rules->rule($type, 1) === null) {
            throw ApiException::unprocessable('APR-BR-15', 'Ese tipo de solicitud no tiene una regla activa de nivel 1.');
        }

        $subject = $this->subject($type, $data);

        return DB::transaction(function () use ($data, $actor, $fx, $amountPen, $type, $subject): string {
            $code = $this->codes->next('collab_approval_requests', 'APR-'.Carbon::now()->year.'-');
            $id = (string) Str::uuid7();

            DB::table('collab_approval_requests')->insert([
                'id' => $id,
                'code' => $code,
                'request_type' => $type,
                'is_generic' => true,
                ...$subject,
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
                'due_at' => Carbon::now()->addHours($this->rules->sla($type, 1, $amountPen)),
                'closed_in_origin' => false,
                'created_by' => $actor->getKey(),
            ]);
            $this->event($id, 'creada', $actor, $data['justification']);
            $this->audit->log('Aprobación', $code, 'crear', null, "{$data['title']} · {$data['currency']} {$data['amount']}");
            $this->notifyApprovers($id, (string) $actor->getKey());

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
        $subject = $this->subject($request->request_type, $data);
        $snapshot = array_diff_key(json_decode((string) $request->origin_snapshot, true) ?: [], ['reservation' => true]);
        $subject['origin_snapshot'] = json_encode([...$snapshot, ...(json_decode($subject['origin_snapshot'], true) ?: [])]);
        DB::table('collab_approval_requests')->where('id', $request->id)->update([
            'title' => $data['title'],
            'justification' => $data['justification'],
            ...$subject,
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

        if (! $request->is_generic && ! in_array($request->request_type, ApprovalRules::WITHDRAWABLE, true)) {
            throw ApiException::conflict('APR-WITHDRAW-ORIGIN', 'Esta solicitud se resuelve en su módulo de origen; no se retira desde la bandeja.');
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
        $rule = $this->levelRule($request);

        if ($approve && $request->request_type === 'reversal' && $level >= (int) $request->total_levels) {
            $this->assertReversible($request);
        }

        $this->assertApprover($request, $rule, $actor);

        if ($request->status === 'info') {
            throw ApiException::conflict('APR-BR-10', 'La solicitud espera la respuesta a una consulta; decide cuando la respondan.');
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
                : ['current_level' => $level + 1, 'due_at' => Carbon::now()->addHours($this->rules->sla($request->request_type, $level + 1, $this->amountPen($request))), 'delegated_to' => null];

            DB::table('collab_approval_requests')->where('id', $request->id)->update([...$values, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);

            if ($approve && $final && $request->request_type === 'reversal') {
                $this->payments->revert((string) $request->subject_code, trim('Reversión aprobada en la bandeja '.$request->code.'. '.($note ?? $request->justification ?? '')), $actor);
                DB::table('fin_payments')->where('code', $request->subject_code)->update(['reversal_request_id' => $request->id]);
            }

            if ($approve && $final && $request->request_type === 'credit_b2b') {
                $this->extendCredit($request, $actor);
            }

            if ($approve && $final && $request->request_type === 'refund') {
                $this->registerRefund($request, $actor);
            }

            $this->event($request->id, $approve ? ($final ? 'aprobada' : 'aprobada_nivel') : 'rechazada', $actor, $note);
            $this->audit->log('Aprobación', $request->code, $approve ? ($final ? 'aprobar' : "aprobar_nivel_{$level}") : 'rechazar', $request->status, $status);

            if ($final) {
                $this->notifyRequester($request, 'aprobacion.resultado', $approve ? 'aprobada' : 'rechazada', $note, (string) $actor->getKey());
            } else {
                $this->notifyApprovers((string) $request->id, (string) $actor->getKey());
            }

            return $status;
        });
    }

    public function delegate(string $code, string $userId, ?string $note, ?int $version, User $actor): void
    {
        $request = $this->open($code);
        $rule = $this->levelRule($request);
        $this->assertApprover($request, $rule, $actor);
        $this->assertVersion($request, $version);

        $deciders = DB::table('collab_approval_steps')->where('request_id', $request->id)->pluck('decided_by')->map(fn ($id): string => (string) $id)->all();
        $target = collect($this->rules->eligible($rule->permission))->firstWhere('id', $userId);

        if ($target === null || $userId === $actor->getKey() || $userId === $request->requester_id || in_array($userId, $deciders, true)) {
            throw ApiException::unprocessable('APR-BR-04', 'Delega en otra persona que tenga el permiso de este nivel y no haya pedido ni decidido la solicitud.');
        }

        DB::transaction(function () use ($request, $userId, $target, $note, $actor): void {
            $previous = $request->delegated_to ? DB::table('iam_users')->where('id', $request->delegated_to)->value('name') : null;
            $this->touch($request, ['delegated_to' => $userId], $actor);
            $this->event($request->id, 'delegada', $actor, trim("Delegada a {$target['name']}. ".($note ?? '')));
            $this->audit->log('Aprobación', $request->code, 'delegar', $previous ?? 'Sin delegar', $target['name']);
            app(StaffNotices::class)->toUser($userId, 'aprobacion.delegada', "{$request->code} · te delegaron una aprobación", trim("{$request->title} ".($note ?? '')), 'collab_approval_request', (string) $request->id, null, (string) $actor->getKey());
        });
    }

    public function askInfo(string $code, string $question, ?int $version, User $actor): void
    {
        $request = $this->open($code);
        $this->assertApprover($request, $this->levelRule($request), $actor);
        $this->assertVersion($request, $version);

        if ($request->status === 'info') {
            throw ApiException::conflict('APR-BR-10', 'Ya hay una consulta esperando respuesta.');
        }

        DB::transaction(function () use ($request, $question, $actor): void {
            DB::table('collab_approval_info_requests')->insert([
                'id' => (string) Str::uuid7(),
                'request_id' => $request->id,
                'asked_by' => $actor->getKey(),
                'question' => $question,
                'asked_at' => now(),
                'created_by' => $actor->getKey(),
            ]);
            $this->touch($request, ['status' => 'info', 'paused_at' => now()], $actor);
            $this->event($request->id, 'info_solicitada', $actor, $question);
            $this->audit->log('Aprobación', $request->code, 'pedir_informacion', $request->status, 'info');
            $this->notifyRequester($request, 'aprobacion.informacion', 'te piden más información', $question, (string) $actor->getKey());
        });
    }

    public function answerInfo(string $code, string $infoId, string $answer, User $actor): void
    {
        $request = $this->open($code);
        $info = DB::table('collab_approval_info_requests')->where('request_id', $request->id)->where('id', $infoId)->first() ?? throw ApiException::notFound('La consulta no existe.');

        if ($info->answered_at !== null || $request->status !== 'info') {
            throw ApiException::conflict('APR-BR-10', 'Esta consulta ya fue respondida.');
        }

        if ($request->requester_id !== $actor->getKey() && ! $actor->can('crm.records.reassign')) {
            throw ApiException::forbidden('APR-BR-10', 'Responde quien pidió la aprobación o la gerencia.', ['crm.records.reassign']);
        }

        if ($info->asked_by === $actor->getKey()) {
            throw ApiException::forbidden('APR-BR-03', 'Quien hizo la consulta no puede responderla.');
        }

        DB::transaction(function () use ($request, $info, $answer, $actor): void {
            $paused = $request->paused_at ? Carbon::parse($request->paused_at) : null;
            $due = $request->due_at ? Carbon::parse($request->due_at) : null;
            $extended = $due && $paused ? $due->copy()->addSeconds((int) $paused->diffInSeconds(Carbon::now())) : $due;

            DB::table('collab_approval_info_requests')->where('id', $info->id)->update(['answer' => $answer, 'answered_by' => $actor->getKey(), 'answered_at' => now(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->touch($request, ['status' => 'pendiente', 'paused_at' => null, 'due_at' => $extended], $actor);
            $this->event($request->id, 'info_respondida', $actor, $answer);
            $this->audit->log('Aprobación', $request->code, 'responder_informacion', 'info', 'pendiente');
        });
    }

    public function resubmit(string $code, string $note, User $actor): string
    {
        $request = DB::table('collab_approval_requests')->where('code', $code)->first() ?? throw ApiException::notFound('La solicitud no existe.');
        $permission = ['payable' => 'finance.payables', 'commission' => 'finance.commissions'][$request->request_type] ?? null;

        if (! array_key_exists($request->request_type, ApprovalInbox::TYPES) || in_array($request->subject_type, OriginClosure::MIRRORED, true)) {
            throw ApiException::notFound('La solicitud no existe.');
        }

        if ($request->status !== 'rechazada') {
            throw ApiException::conflict('APR-BR-08', 'Solo se reenvía una solicitud rechazada.');
        }

        if ($permission === null) {
            throw ApiException::conflict('APR-RESUBMIT-TYPE', 'Solo se reenvían las solicitudes de cuentas por pagar y de comisiones; las demás se piden de nuevo desde su origen.');
        }

        if ($request->requester_id !== $actor->getKey() && ! $actor->can($permission)) {
            throw ApiException::forbidden('APR-BR-03', 'Solo quien pidió la aprobación puede reenviarla.', [$permission]);
        }

        if (DB::table('collab_approval_requests')->whereRaw("origin_snapshot->>'resubmitted_from' = ?", [$code])->exists()) {
            throw ApiException::conflict('APR-BR-11', 'Esta solicitud ya se reenvió.');
        }

        $snapshot = json_decode((string) $request->origin_snapshot, true) ?: [];
        $round = (int) ($snapshot['round'] ?? 1) + 1;
        $amountPen = round((float) $request->amount * (float) $request->fx_rate, 2);

        return DB::transaction(function () use ($request, $note, $actor, $round, $snapshot, $amountPen): string {
            $newCode = $this->codes->next('collab_approval_requests', 'APR-'.Carbon::now()->year.'-');
            $id = (string) Str::uuid7();
            $base = preg_replace('/:r\d+$/', '', (string) $request->dedupe_key);

            DB::table('collab_approval_requests')->insert([
                'id' => $id,
                'code' => $newCode,
                'request_type' => $request->request_type,
                'is_generic' => $request->is_generic,
                'subject_type' => $request->subject_type,
                'subject_id' => $request->subject_id,
                'subject_code' => $request->subject_code,
                'subject_version' => $request->subject_version,
                'dedupe_key' => "{$base}:r{$round}",
                'title' => $request->title,
                'justification' => $request->justification,
                'requester_id' => $request->requester_id ?? $actor->getKey(),
                'requester_kind' => $request->requester_id ? $request->requester_kind : 'user',
                'requester_supplier_id' => $request->requester_supplier_id,
                'amount' => $request->amount,
                'currency' => $request->currency,
                'fx_rate' => $request->fx_rate,
                'status' => 'pendiente',
                'current_level' => 1,
                'total_levels' => $this->rules->levels($request->request_type, $amountPen),
                'due_at' => Carbon::now()->addHours($this->rules->sla($request->request_type, 1, $amountPen)),
                'closed_in_origin' => false,
                'origin_snapshot' => json_encode([...$snapshot, 'resubmitted_from' => $request->code, 'round' => $round]),
                'created_by' => $actor->getKey(),
            ]);
            $this->event($id, 'reenviada', $actor, "Ronda {$round} de {$request->code}. {$note}");
            $this->event($request->id, 'reenviada', $actor, "Reenviada como {$newCode}. {$note}");
            $this->notifyApprovers($id, (string) $actor->getKey());
            $this->audit->log('Aprobación', $newCode, 'reenviar', $request->code, "ronda {$round}");

            return $newCode;
        });
    }

    public function createRule(array $data, User $actor): string
    {
        $this->assertHolders($data['permission']);
        $this->assertUniqueRule($data['type'], 2, (float) $data['min_amount']);

        return DB::transaction(function () use ($data, $actor): string {
            $code = $this->codes->next('collab_approval_rules', 'RA-', 2);
            DB::table('collab_approval_rules')->insert([
                'id' => (string) Str::uuid7(),
                'code' => $code,
                'request_type' => $data['type'],
                'level' => 2,
                'permission' => $data['permission'],
                'min_amount_pen' => $data['min_amount'],
                'sla_hours' => $data['sla_hours'],
                'forbid_self_approval' => $data['forbid_self'],
                'is_active' => $data['active'],
                'is_origin_locked' => false,
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ]);
            $this->rules->forget();
            $this->recalculatePending($data['type'], $actor);
            $this->audit->log('Regla de aprobación', $code, 'crear', null, "{$data['type']} N2 · {$data['permission']} · desde S/ {$data['min_amount']} · {$data['sla_hours']} h");

            return $code;
        });
    }

    public function deleteRule(string $code, User $actor): void
    {
        $rule = DB::table('collab_approval_rules')->whereNull('deleted_at')->where('code', $code)->first() ?? throw ApiException::notFound('La regla no existe.');

        if ((int) $rule->level !== 2) {
            throw ApiException::unprocessable('APR-BR-15', 'Solo se eliminan reglas de nivel 2: el nivel 1 se desactiva o se edita.');
        }

        DB::transaction(function () use ($rule, $actor): void {
            DB::table('collab_approval_rules')->where('id', $rule->id)->update(['deleted_at' => now(), 'is_active' => false, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->rules->forget();
            $this->recalculatePending($rule->request_type, $actor);
            $this->audit->log('Regla de aprobación', $rule->code, 'eliminar', "{$rule->request_type} N2 · {$rule->permission} · desde S/ {$rule->min_amount_pen}", null);
        });
    }

    public function resetRules(User $actor): int
    {
        return DB::transaction(function () use ($actor): int {
            $defaults = collect(ApprovalRules::DEFAULTS)->keyBy('code');
            $removed = DB::table('collab_approval_rules')->whereNull('deleted_at')->whereNotIn('code', $defaults->keys()->all())
                ->update(['deleted_at' => now(), 'is_active' => false, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);

            foreach ($defaults as $code => $default) {
                $values = [
                    'request_type' => $default['type'],
                    'level' => $default['level'],
                    'permission' => $default['permission'],
                    'min_amount_pen' => $default['min'],
                    'sla_hours' => $default['sla'],
                    'forbid_self_approval' => true,
                    'is_active' => true,
                    'is_origin_locked' => $default['level'] === 1 && in_array($default['type'], ApprovalRules::ORIGIN_LOCKED, true),
                    'deleted_at' => null,
                    'updated_by' => $actor->getKey(),
                    'updated_at' => now(),
                ];

                $existing = DB::table('collab_approval_rules')->where('code', $code)->orderByRaw('deleted_at is null desc')->orderByDesc('updated_at')->value('id');

                if ($existing !== null) {
                    DB::table('collab_approval_rules')->where('code', $code)->where('id', '<>', $existing)->whereNull('deleted_at')->update(['deleted_at' => now(), 'is_active' => false]);
                    DB::table('collab_approval_rules')->where('id', $existing)->update($values);
                } else {
                    DB::table('collab_approval_rules')->insert([...$values, 'id' => (string) Str::uuid7(), 'code' => $code, 'created_by' => $actor->getKey()]);
                }
            }

            $this->rules->forget();

            foreach (ApprovalRules::RULE_TYPES as $type) {
                $this->recalculatePending($type, $actor);
            }

            $this->audit->log('Regla de aprobación', 'matriz', 'restaurar', $removed > 0 ? "{$removed} reglas propias eliminadas" : null, $defaults->count().' reglas por defecto');

            return $defaults->count();
        });
    }

    public function updateRule(string $code, array $data, User $actor): void
    {
        $rule = DB::table('collab_approval_rules')->whereNull('deleted_at')->where('code', $code)->first() ?? throw ApiException::notFound('La regla no existe.');

        if (! $rule->is_origin_locked && isset($data['permission']) && $data['permission'] !== $rule->permission) {
            $this->assertHolders($data['permission']);
        }

        if ((float) $data['min_amount'] !== (float) $rule->min_amount_pen) {
            $this->assertUniqueRule($rule->request_type, (int) $rule->level, (float) $data['min_amount'], $rule->id);
        }

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
        $this->recalculatePending($rule->request_type, $actor);
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

    private function notifyApprovers(string $requestId, ?string $exceptUser): void
    {
        $request = DB::table('collab_approval_requests')->where('id', $requestId)->first();
        $rule = $request ? $this->rules->rule($request->request_type, (int) $request->current_level, $this->amountPen($request)) : null;

        if ($request === null || $rule === null) {
            return;
        }

        $users = collect($this->rules->eligible($rule->permission))->pluck('id')->reject(fn ($id): bool => (string) $id === (string) $request->requester_id);
        app(StaffNotices::class)->toUsers($users->reject(fn ($id): bool => (string) $id === (string) $exceptUser), 'aprobacion.solicitada', "{$request->code} · aprobación por decidir (nivel {$request->current_level})", "{$request->title} · {$request->currency} {$request->amount}", 'collab_approval_request', (string) $request->id);
    }

    private function notifyRequester(object $request, string $event, string $subject, ?string $body, string $actorId): void
    {
        app(StaffNotices::class)->toUser($request->requester_id ? (string) $request->requester_id : null, $event, "{$request->code} · {$subject}", $body, 'collab_approval_request', (string) $request->id, null, $actorId);
    }

    private function levelRule(object $request): object
    {
        return $this->rules->rule($request->request_type, (int) $request->current_level, $this->amountPen($request)) ?? throw ApiException::conflict('APR-BR-15', 'No hay una regla activa para este nivel.');
    }

    private function amountPen(object $request): float
    {
        return round((float) $request->amount * (float) $request->fx_rate, 2);
    }

    private function subject(string $type, array $data): array
    {
        $agency = isset($data['agency']) ? DB::table('channel_b2b_agencies')->whereNull('deleted_at')->where('code', $data['agency'])->first(['id', 'code']) : null;
        $reservation = isset($data['reservation']) ? DB::table('booking_reservations')->whereNull('deleted_at')->where('code', $data['reservation'])->first(['id', 'code']) : null;

        if (isset($data['agency']) && $agency === null) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'La agencia B2B elegida no existe.');
        }

        if (isset($data['reservation']) && $reservation === null) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'La reserva elegida no existe.');
        }

        if ($type === 'credit_b2b' && $agency === null) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'Una solicitud de crédito B2B necesita la agencia.');
        }

        $main = $agency ? ['channel_b2b_agencies', $agency] : ($reservation ? ['booking_reservations', $reservation] : [null, null]);

        return [
            'subject_type' => $main[0],
            'subject_id' => $main[1]?->id,
            'subject_code' => $main[1]?->code,
            'origin_snapshot' => json_encode(array_filter(['reservation' => $agency && $reservation ? $reservation->code : null])),
        ];
    }

    private function extendCredit(object $request, User $actor): void
    {
        $agency = DB::table('channel_b2b_agencies')->where('id', $request->subject_id)->lockForUpdate()->first(['id', 'code', 'credit_limit', 'credit_used', 'status', 'block_reason']);

        if ($agency === null) {
            return;
        }

        $limit = round((float) $agency->credit_limit + (float) $request->amount, 2);
        $unblock = $agency->status === 'bloqueada' && $agency->block_reason === 'credito_excedido' && (float) $agency->credit_used <= $limit;
        DB::table('channel_b2b_agencies')->where('id', $agency->id)->update(['credit_limit' => $limit, ...($unblock ? ['status' => 'activa', 'block_reason' => null] : []), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        DB::table('channel_b2b_credit_exceptions')->insert(['agency_id' => $agency->id, 'approval_request_id' => $request->id, 'amount' => $request->amount, 'valid_until' => null, 'created_by' => $actor->getKey()]);
        $this->audit->log('Agencia B2B', (string) $agency->code, 'ampliar_credito', (string) $agency->credit_limit, $limit.' · '.$request->code.($unblock ? ' · reactivada' : ''));
    }

    private function registerRefund(object $request, User $actor): void
    {
        $reservation = $request->subject_type === 'booking_reservations' ? DB::table('booking_reservations')->where('id', $request->subject_id)->first(['id', 'code', 'currency', 'fx_rate']) : null;

        if ($reservation === null) {
            return;
        }

        $code = app(SequenceService::class)->next('payment');
        DB::table('fin_payments')->insert(['code' => $code, 'reservation_id' => $reservation->id, 'kind' => 'reembolso', 'source' => 'sistema', 'method' => 'Reembolso aprobado', 'amount' => $request->amount, 'currency' => $request->currency, 'fx_rate' => $request->currency === 'USD' ? $request->fx_rate : null, 'paid_on' => now()->toDateString(), 'reference' => "Aprobación {$request->code}", 'status' => 'pendiente', 'registered_by' => $actor->getKey(), 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
        $this->audit->log('Pago', $code, 'crear', null, "reembolso pendiente · {$request->currency} {$request->amount} · {$request->code}");
        app(StaffNotices::class)->toRoles(['finance'], 'reembolso.por_pagar', "{$code} · reembolso aprobado por registrar", "{$reservation->code} · {$request->currency} {$request->amount}", 'fin_payment', null, $reservation->id);
    }

    private function assertReversible(object $request): void
    {
        $status = DB::table('fin_payments')->where('code', $request->subject_code)->value('status');

        if (! in_array($status, ['confirmado', 'aplicado'], true)) {
            throw ApiException::conflict('APR-BR-09', 'Solo se revierte un pago confirmado o aplicado; este pago ya no lo está.');
        }
    }

    private function assertHolders(string $permission): void
    {
        $this->rules->forget();

        if ($this->rules->eligible($permission) === []) {
            throw ApiException::unprocessable('APR-BR-15', 'Ningún usuario activo tiene ese permiso: nadie podría aprobar este nivel.');
        }
    }

    private function assertUniqueRule(string $type, int $level, float $min, ?string $ignore = null): void
    {
        $exists = DB::table('collab_approval_rules')->whereNull('deleted_at')->where('request_type', $type)->where('level', $level)->where('min_amount_pen', $min)
            ->when($ignore, fn ($query) => $query->where('id', '<>', $ignore))->exists();

        if ($exists) {
            throw ApiException::conflict('APR-BR-15', 'Ya existe una regla para ese tipo, nivel y monto.');
        }
    }

    private function recalculatePending(string $type, User $actor): void
    {
        $this->rules->forget();
        DB::table('collab_approval_requests')->where('request_type', $type)->whereIn('status', ['pendiente', 'info'])->get(['id', 'amount', 'fx_rate', 'current_level', 'total_levels'])
            ->each(function (object $request) use ($actor, $type): void {
                $levels = max((int) $request->current_level, $this->rules->levels($type, $this->amountPen($request)));

                if ($levels !== (int) $request->total_levels) {
                    DB::table('collab_approval_requests')->where('id', $request->id)->update(['total_levels' => $levels, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
                }
            });
    }

    private function assertApprover(object $request, object $rule, User $actor): void
    {
        if (! $actor->can($rule->permission)) {
            throw ApiException::forbidden('APR-BR-04', 'Tu rol no aprueba este nivel.', [$rule->permission]);
        }

        if ($request->delegated_to !== null && $request->delegated_to !== $actor->getKey()) {
            throw ApiException::forbidden('APR-BR-04', 'Esta solicitud está delegada en otra persona.', [$rule->permission]);
        }

        if ($rule->forbid_self_approval && $request->requester_id === $actor->getKey()) {
            throw ApiException::forbidden('APR-BR-03', 'No puedes aprobar tu propia solicitud.');
        }

        if (DB::table('collab_approval_steps')->where('request_id', $request->id)->where('decided_by', $actor->getKey())->exists()) {
            throw ApiException::forbidden('APR-BR-03', 'Ya decidiste un nivel anterior de esta solicitud.');
        }
    }

    private function assertVersion(object $request, ?int $version): void
    {
        if ($version !== null && $version !== (int) $request->lock_version) {
            throw ApiException::conflict('STALE_VERSION', 'Otra persona acaba de cambiar esta solicitud. Actualiza la bandeja.');
        }
    }

    private function touch(object $request, array $values, User $actor): void
    {
        $updated = DB::table('collab_approval_requests')->where('id', $request->id)->where('lock_version', $request->lock_version)
            ->update([...$values, 'lock_version' => $request->lock_version + 1, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);

        if ($updated === 0) {
            throw ApiException::conflict('STALE_VERSION', 'Otra persona acaba de cambiar esta solicitud. Actualiza la bandeja.');
        }
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
