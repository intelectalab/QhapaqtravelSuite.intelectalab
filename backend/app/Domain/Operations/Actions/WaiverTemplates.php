<?php

declare(strict_types=1);

namespace App\Domain\Operations\Actions;

use App\Domain\Finance\Support\GrowthFeatureGate;
use App\Domain\Iam\Models\User;
use App\Domain\Operations\Support\CheckinPasses;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Sequences\SequenceService;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class WaiverTemplates
{
    public const LANGS = ['es' => 'Español', 'en' => 'Inglés', 'pt' => 'Portugués', 'fr' => 'Francés', 'de' => 'Alemán'];

    public function __construct(
        private readonly TenantContext $context,
        private readonly SequenceService $sequences,
        private readonly AuditLogger $audit,
        private readonly GrowthFeatureGate $gate,
    ) {}

    public static function rules(): array
    {
        return [
            'code' => ['nullable', 'string', 'max:30'],
            'name' => ['required', 'string', 'min:3', 'max:120'],
            'lang' => ['nullable', 'in:'.implode(',', array_keys(self::LANGS))],
            'body' => ['required', 'string', 'min:40', 'max:20000'],
            'requires_guardian_for_minors' => ['nullable', 'boolean'],
        ];
    }

    public static function messages(): array
    {
        return [
            'name.*' => 'Escribe un nombre de 3 a 120 caracteres.',
            'lang.*' => 'Elige el idioma del texto.',
            'body.required' => 'Escribe el texto del deslinde.',
            'body.min' => 'El texto del deslinde debe tener al menos 40 caracteres.',
            'body.max' => 'El texto del deslinde admite hasta 20 000 caracteres.',
            'requires_guardian_for_minors.*' => 'Indica si los menores firman con su tutor.',
        ];
    }

    public function list(): array
    {
        $this->gate->require(CheckinPasses::RULE);
        $rows = DB::table('ops_waiver_templates as t')->leftJoin('iam_users as u', 'u.id', '=', 't.created_by')
            ->orderBy('t.code')->orderByDesc('t.version')
            ->get(['t.id', 't.code', 't.name', 't.lang', 't.version', 't.body', 't.requires_guardian_for_minors', 't.active', 't.created_at', 'u.name as created_by']);
        $signed = DB::table('ops_waiver_signatures')->select(['template_id', DB::raw('count(*) as total')])->groupBy('template_id')->pluck('total', 'template_id');

        return [
            'templates' => $rows->groupBy('code')->map(fn ($versions, string $code) => [
                'code' => $code,
                'name' => $versions->first()->name,
                'lang' => $versions->first()->lang,
                'lang_label' => self::LANGS[$versions->first()->lang] ?? $versions->first()->lang,
                'active' => (bool) $versions->first()->active,
                'current_version' => (int) $versions->first()->version,
                'signatures' => (int) $versions->sum(fn (object $row) => (int) ($signed[$row->id] ?? 0)),
                'versions' => $versions->map(fn (object $row) => [
                    'id' => $row->id,
                    'version' => (int) $row->version,
                    'name' => $row->name,
                    'body' => $row->body,
                    'requires_guardian_for_minors' => (bool) $row->requires_guardian_for_minors,
                    'active' => (bool) $row->active,
                    'signatures' => (int) ($signed[$row->id] ?? 0),
                    'created_by' => $row->created_by,
                    'created_at' => Carbon::parse((string) $row->created_at)->toIso8601String(),
                ])->values()->all(),
            ])->values()->all(),
            'langs' => collect(self::LANGS)->map(fn (string $label, string $key) => ['key' => $key, 'label' => $label])->values()->all(),
        ];
    }

    public function create(array $data, User $actor): array
    {
        $this->gate->require(CheckinPasses::RULE);

        return DB::transaction(function () use ($data, $actor): array {
            $code = trim((string) ($data['code'] ?? ''));
            $previous = null;

            if ($code !== '') {
                DB::select('select pg_advisory_xact_lock(hashtext(?))', [$this->context->idOrFail().':waiver:'.$code]);
                $previous = DB::table('ops_waiver_templates')->where('code', $code)->orderByDesc('version')->first(['version', 'lang']);

                if ($previous === null) {
                    throw ApiException::unprocessable('WAIVER_TEMPLATE_NOT_FOUND', 'La plantilla '.$code.' no existe. Deja el código vacío para crear una nueva.');
                }
            } else {
                $code = $this->sequences->next('waiver_template');
            }

            $version = $previous === null ? 1 : (int) $previous->version + 1;
            DB::table('ops_waiver_templates')->where('code', $code)->update(['active' => false, 'updated_by' => $actor->getKey()]);
            DB::table('ops_waiver_templates')->insert([
                'tenant_id' => $this->context->idOrFail(),
                'code' => $code,
                'name' => trim((string) $data['name']),
                'lang' => $data['lang'] ?? ($previous->lang ?? 'es'),
                'version' => $version,
                'body' => trim((string) $data['body']),
                'requires_guardian_for_minors' => (bool) ($data['requires_guardian_for_minors'] ?? true),
                'active' => true,
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ]);
            $this->audit->log('Plantilla de deslinde', $code, $version === 1 ? 'crear' : 'nueva_version', $previous ? 'v'.$previous->version : null, 'v'.$version.' · '.trim((string) $data['name']), actor: $actor);

            return collect($this->list()['templates'])->firstWhere('code', $code) ?? [];
        });
    }
}
