<?php

declare(strict_types=1);

namespace App\Domain\Marketing\Actions;

use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Iam\Models\User;
use App\Domain\Marketing\Support\ContactBook;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class SegmentWorkflow
{
    public function __construct(
        private readonly CodeSequence $codes,
        private readonly AuditLogger $audit,
        private readonly ContactBook $contacts,
    ) {}

    public function create(array $data, User $actor): string
    {
        $rules = $this->rules($data['rules'] ?? []);
        $this->ensureUniqueName($data['name']);

        return DB::transaction(function () use ($data, $rules, $actor): string {
            $code = $this->codes->next('mkt_segments', 'SEG-', 3);
            DB::table('mkt_segments')->insert([
                'id' => (string) Str::uuid7(),
                'code' => $code,
                'name' => $data['name'],
                'description' => $data['description'] ?? null,
                'match' => $data['match'],
                'rules' => json_encode($rules, JSON_UNESCAPED_UNICODE),
                'owner_id' => $actor->getKey(),
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ]);
            $this->audit->log('Segmento', $code, 'crear', null, "{$data['name']} · {$this->contacts->describe($rules, $data['match'])}");

            return $code;
        });
    }

    public function update(string $code, array $data, User $actor): void
    {
        $segment = $this->find($code);
        $rules = $this->rules($data['rules'] ?? []);
        $this->ensureUniqueName($data['name'], $segment->id);
        $before = $this->contacts->describe(json_decode((string) $segment->rules, true) ?: [], $segment->match);

        DB::transaction(function () use ($segment, $data, $rules, $actor, $before): void {
            DB::table('mkt_segments')->where('id', $segment->id)->update([
                'name' => $data['name'],
                'description' => $data['description'] ?? null,
                'match' => $data['match'],
                'rules' => json_encode($rules, JSON_UNESCAPED_UNICODE),
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);
            $this->audit->log('Segmento', $segment->code, 'editar', "{$segment->name} · {$before}", "{$data['name']} · {$this->contacts->describe($rules, $data['match'])}");
        });
    }

    public function duplicate(string $code, User $actor): string
    {
        $segment = $this->find($code);
        $name = $this->copyName($segment->name);

        return DB::transaction(function () use ($segment, $name, $actor): string {
            $copy = $this->codes->next('mkt_segments', 'SEG-', 3);
            DB::table('mkt_segments')->insert([
                'id' => (string) Str::uuid7(),
                'code' => $copy,
                'name' => $name,
                'description' => $segment->description,
                'match' => $segment->match,
                'rules' => $segment->rules,
                'owner_id' => $actor->getKey(),
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ]);
            $this->audit->log('Segmento', $copy, 'duplicar', $segment->code, $name);

            return $copy;
        });
    }

    public function delete(string $code, User $actor): void
    {
        $segment = $this->find($code);
        $campaigns = DB::table('mkt_campaigns')->where('segment_id', $segment->id)->count();

        if ($campaigns > 0) {
            throw ApiException::conflict('MKT-BR-12', "El segmento lo usa {$campaigns} ".($campaigns === 1 ? 'campaña' : 'campañas').' y se conserva como evidencia de la audiencia. Puedes duplicarlo.');
        }

        DB::transaction(function () use ($segment, $actor): void {
            DB::table('mkt_segments')->where('id', $segment->id)->update(['deleted_at' => now(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Segmento', $segment->code, 'eliminar', $segment->name, null);
        });
    }

    private function rules(array $rules): array
    {
        $error = $this->contacts->rulesError($rules);

        if ($error !== null) {
            throw ApiException::unprocessable('MKT-BR-13', $error);
        }

        return $this->contacts->normalize($rules);
    }

    private function ensureUniqueName(string $name, ?string $except = null): void
    {
        $taken = DB::table('mkt_segments')->whereRaw('lower(name) = ?', [Str::lower($name)])
            ->when($except !== null, fn ($query) => $query->where('id', '!=', $except))->exists();

        if ($taken) {
            throw ApiException::unprocessable('MKT-BR-13', 'Ya existe un segmento con ese nombre.');
        }
    }

    private function copyName(string $name): string
    {
        $base = Str::limit($name, 140, '').' (copia)';
        $candidate = $base;
        $index = 2;

        while (DB::table('mkt_segments')->whereRaw('lower(name) = ?', [Str::lower($candidate)])->exists()) {
            $candidate = "{$base} {$index}";
            $index++;
        }

        return $candidate;
    }

    private function find(string $code): object
    {
        return DB::table('mkt_segments')->whereNull('deleted_at')->where('code', $code)->first() ?? throw ApiException::notFound('El segmento no existe.');
    }
}
