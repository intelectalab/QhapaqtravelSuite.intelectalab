<?php

declare(strict_types=1);

namespace App\Domain\Admin\Actions;

use App\Domain\Admin\Support\PaxTemplateDirectory;
use App\Domain\Admin\Support\PgArray;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Jobs\SchedulePaxMessages;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class ManagePaxTemplates
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function create(array $data, User $actor): string
    {
        $this->check($data);

        return DB::transaction(function () use ($data, $actor): string {
            $last = DB::table('notif_pax_message_templates')->lockForUpdate()->pluck('code')->map(fn (string $code): int => (int) substr($code, 4))->max() ?? 0;
            $code = 'PMT-'.str_pad((string) ($last + 1), 3, '0', STR_PAD_LEFT);
            DB::table('notif_pax_message_templates')->insert([...$this->values($data), 'code' => $code, 'active' => true, 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
            $this->audit->log('Plantilla de mensaje', $code, 'crear', null, "{$data['name']} · ".implode(', ', $data['channels']));
            $this->reschedule();

            return $code;
        });
    }

    public function update(string $code, array $data, User $actor): void
    {
        $this->check($data);

        DB::transaction(function () use ($code, $data, $actor): void {
            $row = $this->find($code);
            $values = $this->values($data);
            $changed = collect($values)->filter(fn (mixed $value, string $key): bool => match ($key) {
                'conditions' => json_decode((string) $value, true) != json_decode((string) $row->conditions, true),
                'channels' => PgArray::parse((string) $value) !== PgArray::parse($row->channels),
                default => (string) $value !== (string) ($row->{$key} ?? ''),
            })->keys();

            if ($changed->isEmpty()) {
                throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
            }

            DB::table('notif_pax_message_templates')->where('id', $row->id)->update([...$values, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Plantilla de mensaje', $code, 'editar', $changed->implode(', '), $data['name']);
            $this->reschedule();
        });
    }

    public function setActive(string $code, bool $active, User $actor): bool
    {
        return DB::transaction(function () use ($code, $active, $actor): bool {
            $row = $this->find($code);

            if ((bool) $row->active === $active) {
                throw ApiException::unprocessable('CFG-BR-01', $active ? 'La plantilla ya está activa.' : 'La plantilla ya está inactiva.');
            }

            DB::table('notif_pax_message_templates')->where('id', $row->id)->update(['active' => $active, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Plantilla de mensaje', $code, $active ? 'activar' : 'desactivar', $active ? 'inactiva' : 'activa', $active ? 'activa' : 'inactiva');
            $this->reschedule();

            return $active;
        });
    }

    public function delete(string $code): void
    {
        DB::transaction(function () use ($code): void {
            $row = $this->find($code);

            $pending = fn () => DB::table('notif_pax_messages')->where('template_id', $row->id)->where('origin', 'auto')->where('status', 'programado');

            if (DB::table('notif_pax_messages')->where('template_id', $row->id)->whereNotIn('id', $pending()->select('id'))->exists()) {
                throw ApiException::conflict('MSG-04', 'Esta plantilla ya tiene mensajes enviados: desactívala para conservar el historial.');
            }

            $pending()->delete();
            DB::table('notif_pax_message_templates')->where('id', $row->id)->delete();
            $this->audit->log('Plantilla de mensaje', $code, 'eliminar', $row->name, null);
        });
    }

    private function reschedule(): void
    {
        dispatch((new SchedulePaxMessages)->captureTenant())->afterCommit();
    }

    private function check(array $data): void
    {
        $errors = [];
        preg_match_all('/\{\{\s*([a-z_]+)\s*\}\}/', ($data['subject'] ?? '').' '.$data['body'], $matches);
        $unknown = array_values(array_diff(array_unique($matches[1]), array_keys(PaxTemplateDirectory::VARIABLES)));

        if ($unknown !== []) {
            $errors['body'] = 'Estas variables no existen: {{'.implode('}}, {{', $unknown).'}} (MSG-01).';
        }

        if (array_diff($data['channels'], ['whatsapp']) !== [] && trim((string) ($data['subject'] ?? '')) === '') {
            $errors['subject'] = 'El asunto es obligatorio para correo, portal y push (MSG-01).';
        }

        if (in_array('whatsapp', $data['channels'], true) && mb_strlen($data['body']) > 1024) {
            $errors['body'] = 'Para WhatsApp el mensaje no puede superar 1 024 caracteres (MSG-01).';
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    private function values(array $data): array
    {
        return [
            'name' => $data['name'],
            'event' => $data['event'],
            'offset_hours' => (int) $data['offset_hours'],
            'channels' => PgArray::from(array_values(array_unique($data['channels']))),
            'subject' => ($data['subject'] ?? null) ?: null,
            'body' => $data['body'],
            'lang' => $data['lang'],
            'conditions' => json_encode([
                'products' => array_values(array_unique($data['products'] ?? [])),
                'channels' => array_values(array_unique($data['sales_channels'] ?? [])),
                'requiresRule' => $data['requires_rule'] ?? null,
                'onlyIfBalance' => (bool) ($data['only_if_balance'] ?? false),
                'onlyIfMissingDocs' => (bool) ($data['only_if_missing_docs'] ?? false),
            ]),
        ];
    }

    private function find(string $code): object
    {
        return DB::table('notif_pax_message_templates')->where('code', $code)->lockForUpdate()->first() ?? throw ApiException::notFound('La plantilla no existe.');
    }
}
