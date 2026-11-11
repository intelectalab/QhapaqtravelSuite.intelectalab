<?php

declare(strict_types=1);

namespace App\Domain\Marketing\Actions;

use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Iam\Models\User;
use App\Domain\Marketing\Support\SandboxTemplateReviewer;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class TemplateWorkflow
{
    public const VARIABLES = ['nombre', 'destino', 'asesor', 'codigo_promo', 'fecha_viaje', 'agencia', 'enlace_baja'];

    public const CATEGORIES = ['MARKETING' => 'Comercial', 'UTILITY' => 'Utilidad', 'SERVICIO' => 'Servicio'];

    public function __construct(
        private readonly CodeSequence $codes,
        private readonly AuditLogger $audit,
        private readonly SandboxTemplateReviewer $reviewer,
    ) {}

    public function create(array $data, User $actor): string
    {
        $this->validateContent($data['channel'], $data);
        $whatsapp = $data['channel'] === 'whatsapp';
        $review = $whatsapp ? $this->reviewer->submit($data['name'], $data['category'], $data['body'], null) : null;

        return DB::transaction(function () use ($data, $actor, $whatsapp, $review): string {
            $code = $this->codes->next('mkt_templates', 'TPL-', 2);
            DB::table('mkt_templates')->insert([
                'id' => (string) Str::uuid7(),
                'code' => $code,
                'name' => $data['name'],
                'channel' => $data['channel'],
                'category' => $data['category'],
                'status' => $whatsapp ? 'en_revision' : 'activa',
                'provider_template_id' => $review?->externalId,
                'subject' => $whatsapp ? null : $data['subject'],
                'body' => $data['body'],
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ]);
            $this->audit->log('Plantilla', $code, 'crear', null, $whatsapp ? "{$data['name']} · enviada a revisión de Meta" : $data['name']);

            return $code;
        });
    }

    public function update(string $code, array $data, User $actor): string
    {
        $template = $this->find($code);

        if (isset($data['meta_status'])) {
            return $this->respond($template, $data['meta_status'], $actor);
        }

        $this->validateContent($template->channel, $data);
        $whatsapp = $template->channel === 'whatsapp';
        $changed = $template->name !== $data['name'] || $template->category !== $data['category'] || $template->body !== $data['body'];
        $resubmit = $whatsapp && $changed && $template->status !== 'en_revision';
        $review = $whatsapp && $changed ? $this->reviewer->submit($data['name'], $data['category'], $data['body'], $template->provider_template_id) : null;
        $status = $whatsapp ? ($changed ? 'en_revision' : $template->status) : 'activa';

        DB::transaction(function () use ($template, $data, $actor, $whatsapp, $review, $status, $resubmit): void {
            DB::table('mkt_templates')->where('id', $template->id)->update([
                'name' => $data['name'],
                'category' => $data['category'],
                'subject' => $whatsapp ? null : $data['subject'],
                'body' => $data['body'],
                'status' => $status,
                'provider_template_id' => $review !== null ? $review->externalId : $template->provider_template_id,
                'reviewed_at' => $resubmit ? null : $template->reviewed_at,
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);
            $this->audit->log('Plantilla', $template->code, 'editar', $template->status, $resubmit ? "{$status} · vuelve a revisión de Meta" : $status);
        });

        return $status;
    }

    private function respond(object $template, string $status, User $actor): string
    {
        if ($template->channel !== 'whatsapp' || $template->status !== 'en_revision') {
            throw ApiException::conflict('MKT-BR-03', 'Solo se registra la respuesta de Meta de una plantilla de WhatsApp en revisión.');
        }

        $result = $this->reviewer->respond((string) $template->provider_template_id, $status);

        if (! $result->ok) {
            throw ApiException::unprocessable('MKT-BR-03', (string) $result->message);
        }

        DB::transaction(function () use ($template, $result, $actor): void {
            DB::table('mkt_templates')->where('id', $template->id)->update(['status' => $result->status, 'reviewed_at' => now(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Plantilla', $template->code, 'aprobacion_meta', 'en_revision', $result->status);
        });

        return $result->status;
    }

    private function validateContent(string $channel, array $data): void
    {
        if ($channel === 'whatsapp' && ! preg_match('/^[a-z0-9_]+$/', $data['name'])) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'El nombre de una plantilla de WhatsApp solo admite minúsculas, números y guion bajo, como en Meta.');
        }

        if ($channel === 'email' && trim((string) ($data['subject'] ?? '')) === '') {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'La plantilla de correo necesita un asunto.');
        }

        preg_match_all('/\{\{\s*([^}]*?)\s*\}\}/', $data['body'].' '.($data['subject'] ?? ''), $found);
        $unknown = array_values(array_diff(array_unique($found[1]), self::VARIABLES));

        if ($unknown !== []) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'Variable desconocida: {{'.$unknown[0].'}}. Usa '.implode(', ', array_map(fn (string $name): string => "{{{$name}}}", self::VARIABLES)).'.');
        }

        if ($data['category'] !== 'MARKETING') {
            return;
        }

        if ($channel === 'email' && ! str_contains($data['body'], '{{enlace_baja}}')) {
            throw ApiException::unprocessable('MKT-BR-02', 'El correo comercial debe incluir {{enlace_baja}} para que el contacto pueda darse de baja.');
        }

        if ($channel === 'whatsapp' && ! str_contains(Str::upper($data['body']), 'BAJA')) {
            throw ApiException::unprocessable('MKT-BR-02', 'El mensaje comercial de WhatsApp debe indicar «Responde BAJA» para darse de baja.');
        }
    }

    private function find(string $code): object
    {
        return DB::table('mkt_templates')->where('code', $code)->first() ?? throw ApiException::notFound('La plantilla no existe.');
    }
}
