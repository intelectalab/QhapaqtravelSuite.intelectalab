<?php

declare(strict_types=1);

namespace App\Domain\Corporate\Actions;

use App\Domain\Corporate\Support\CorporateDirectory;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use OpenSpout\Reader\XLSX\Reader;
use Throwable;

final class CorporateStructure
{
    public const DOC_TYPES = ['DNI', 'CE', 'PAS', 'RUC', 'OTRO'];

    private const IMPORT_LIMIT = 500;

    private const IMPORT_COLUMNS = ['nombre' => 'full_name', 'nombre_completo' => 'full_name', 'full_name' => 'full_name', 'correo' => 'email', 'email' => 'email', 'tipo_documento' => 'doc_type', 'doc_type' => 'doc_type', 'documento' => 'doc_number', 'numero_documento' => 'doc_number', 'doc_number' => 'doc_number', 'codigo_empleado' => 'employee_code', 'employee_code' => 'employee_code', 'centro_costo' => 'cost_center', 'centro_de_costo' => 'cost_center', 'cost_center' => 'cost_center'];

    public function __construct(private readonly CorporateDirectory $directory, private readonly AuditLogger $audit) {}

    public function createCostCenter(object $account, array $data): string
    {
        $code = Str::upper(trim((string) $data['code']));

        if (preg_match('/^[A-Z0-9-]{2,20}$/', $code) !== 1) {
            throw ApiException::unprocessable('CORP_COST_CENTER_CODE', 'El código usa de 2 a 20 letras mayúsculas, números o guiones. Por ejemplo: CC-MKT.');
        }

        if (DB::table('crm_corporate_cost_centers')->where('account_id', $account->id)->where('code', $code)->exists()) {
            throw ApiException::unprocessable('CORP_COST_CENTER_DUPLICATE', "Ya existe el centro de costo {$code} en esta cuenta.");
        }

        return DB::transaction(function () use ($account, $data, $code): string {
            $id = (string) Str::uuid7();
            DB::table('crm_corporate_cost_centers')->insert([
                'id' => $id,
                'account_id' => $account->id,
                'code' => $code,
                'name' => trim((string) $data['name']),
                'budget_amount' => $this->amount($data['budget_amount'] ?? null),
                'budget_period' => $data['budget_period'] ?? 'anual',
                'active' => true,
            ]);

            if ($account->default_cost_center_id === null) {
                DB::table('crm_corporate_accounts')->where('id', $account->id)->update(['default_cost_center_id' => $id]);
            }

            $this->audit->log('Centro de costo', "{$account->client_code}/{$code}", 'crear', null, trim($data['name'].' · presupuesto '.($this->amount($data['budget_amount'] ?? null) ?? 'sin tope')));

            return $id;
        });
    }

    public function updateCostCenter(object $account, object $center, array $data): void
    {
        $values = array_filter([
            'name' => array_key_exists('name', $data) ? trim((string) $data['name']) : null,
            'budget_period' => $data['budget_period'] ?? null,
        ], fn ($value) => $value !== null);

        if (array_key_exists('budget_amount', $data)) {
            $values['budget_amount'] = $this->amount($data['budget_amount']);
        }

        if (array_key_exists('active', $data)) {
            $values['active'] = (bool) $data['active'];
            if (! $values['active'] && $account->default_cost_center_id === $center->id) {
                throw ApiException::unprocessable('CORP_COST_CENTER_DEFAULT', 'Es el centro de costo por defecto de la cuenta. Elige otro por defecto antes de desactivarlo.');
            }
            if (! $values['active'] && DB::table('crm_corporate_portal_users')->where('cost_center_id', $center->id)->where('portal_role', 'aprobador')->where('status', '<>', 'inactivo')->exists()) {
                throw ApiException::unprocessable('CORP_COST_CENTER_APPROVER', 'Hay aprobadores asignados a este centro de costo. Cámbialos de centro antes de desactivarlo.');
            }
        }

        if ($values === []) {
            return;
        }

        DB::transaction(function () use ($account, $center, $values): void {
            DB::table('crm_corporate_cost_centers')->where('id', $center->id)->update($values);
            $before = ['name' => $center->name, 'budget_amount' => $center->budget_amount, 'budget_period' => $center->budget_period, 'active' => (bool) $center->active];
            $after = [...$before, ...$values];
            $this->audit->log('Centro de costo', "{$account->client_code}/{$center->code}", array_key_exists('active', $values) && ! $values['active'] ? 'desactivar' : 'actualizar', json_encode($before, JSON_UNESCAPED_UNICODE), json_encode($after, JSON_UNESCAPED_UNICODE));
        });
    }

    public function createTraveler(object $account, array $data): string
    {
        $values = $this->travelerValues($account, $data);
        $this->assertTravelerUnique($account, $values, null);

        return DB::transaction(function () use ($account, $values): string {
            $id = (string) Str::uuid7();
            DB::table('crm_corporate_travelers')->insert(['id' => $id, 'account_id' => $account->id, ...$values, 'active' => true]);
            $this->audit->log('Viajero corporativo', "{$account->client_code}/{$values['full_name']}", 'crear', null, $this->travelerSummary($values));

            return $id;
        });
    }

    public function updateTraveler(object $account, object $traveler, array $data): void
    {
        $merged = [...(array) $traveler, ...$data];
        $values = $this->travelerValues($account, $merged);

        if (array_key_exists('active', $data)) {
            $values['active'] = (bool) $data['active'];
        }

        $this->assertTravelerUnique($account, $values, (string) $traveler->id);

        DB::transaction(function () use ($account, $traveler, $values): void {
            DB::table('crm_corporate_travelers')->where('id', $traveler->id)->update($values);
            $this->audit->log('Viajero corporativo', "{$account->client_code}/{$values['full_name']}", isset($values['active']) && ! $values['active'] ? 'desactivar' : 'actualizar', $this->travelerSummary((array) $traveler), $this->travelerSummary($values));
        });
    }

    public function import(object $account, array $rows, ?UploadedFile $file): array
    {
        $rows = $file !== null ? $this->readFile($file) : $rows;

        if ($rows === []) {
            throw ApiException::unprocessable('CORP_IMPORT_EMPTY', 'El archivo no tiene filas para importar. Usa las columnas nombre, correo, tipo_documento, documento, codigo_empleado y centro_costo.');
        }

        if (count($rows) > self::IMPORT_LIMIT) {
            throw ApiException::unprocessable('CORP_IMPORT_LIMIT', 'Puedes importar hasta '.self::IMPORT_LIMIT.' viajeros por archivo.');
        }

        $created = 0;
        $updated = 0;
        $skipped = [];

        DB::transaction(function () use ($account, $rows, &$created, &$updated, &$skipped): void {
            foreach (array_values($rows) as $index => $row) {
                try {
                    $values = $this->travelerValues($account, $row);
                    $existing = $this->matchTraveler($account, $values);
                    $this->assertTravelerUnique($account, $values, $existing?->id);

                    if ($existing !== null) {
                        DB::table('crm_corporate_travelers')->where('id', $existing->id)->update([...$values, 'active' => true]);
                        $updated++;
                    } else {
                        DB::table('crm_corporate_travelers')->insert(['id' => (string) Str::uuid7(), 'account_id' => $account->id, ...$values, 'active' => true]);
                        $created++;
                    }
                } catch (ApiException $e) {
                    $skipped[] = ['row' => $index + 2, 'message' => $e->getMessage()];
                }
            }

            $this->audit->log('Viajero corporativo', (string) $account->client_code, 'importar', null, "{$created} nuevos · {$updated} actualizados · ".count($skipped).' omitidos');
        });

        return ['created' => $created, 'updated' => $updated, 'skipped' => $skipped, 'total' => count($rows)];
    }

    private function travelerValues(object $account, array $data): array
    {
        $name = trim((string) ($data['full_name'] ?? ''));
        $docType = isset($data['doc_type']) && $data['doc_type'] !== '' ? Str::upper(trim((string) $data['doc_type'])) : null;
        $docNumber = isset($data['doc_number']) && $data['doc_number'] !== '' ? preg_replace('/\s+/', '', (string) $data['doc_number']) : null;
        $email = isset($data['email']) && $data['email'] !== '' ? Str::lower(trim((string) $data['email'])) : null;
        $employee = isset($data['employee_code']) && $data['employee_code'] !== '' ? trim((string) $data['employee_code']) : null;

        if ($name === '' || mb_strlen($name) > 160) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'Escribe el nombre completo del viajero.');
        }

        if ($docType === 'PASAPORTE') {
            $docType = 'PAS';
        }

        if (($docType === null) !== ($docNumber === null)) {
            throw ApiException::unprocessable('CORP_TRAVELER_DOC', 'Indica el tipo y el número de documento juntos, o deja los dos vacíos.');
        }

        if ($docType !== null && ! in_array($docType, self::DOC_TYPES, true)) {
            throw ApiException::unprocessable('CORP_TRAVELER_DOC', 'El tipo de documento debe ser DNI, CE, PAS, RUC u OTRO.');
        }

        if ($email !== null && filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            throw ApiException::unprocessable('VALIDATION_ERROR', "El correo {$email} no es válido.");
        }

        $center = null;
        $key = $data['cost_center_id'] ?? ($data['cost_center'] ?? null);
        if ($key !== null && $key !== '') {
            $center = $this->directory->costCenter($account, (string) $key)->id;
        }

        return [
            'full_name' => $name,
            'email' => $email,
            'doc_type' => $docType,
            'doc_number' => $docNumber === null ? null : mb_substr($docNumber, 0, 20),
            'employee_code' => $employee === null ? null : mb_substr($employee, 0, 30),
            'cost_center_id' => $center,
        ];
    }

    private function assertTravelerUnique(object $account, array $values, ?string $exceptId): void
    {
        $base = DB::table('crm_corporate_travelers')->where('account_id', $account->id)->when($exceptId, fn ($query) => $query->where('id', '<>', $exceptId));

        if ($values['doc_number'] !== null && (clone $base)->where('doc_type', $values['doc_type'])->where('doc_number', $values['doc_number'])->exists()) {
            throw ApiException::unprocessable('CORP_TRAVELER_DUPLICATE', "Ya hay un viajero con el documento {$values['doc_type']} {$values['doc_number']}.");
        }

        if ($values['employee_code'] !== null && (clone $base)->where('employee_code', $values['employee_code'])->exists()) {
            throw ApiException::unprocessable('CORP_TRAVELER_DUPLICATE', "Ya hay un viajero con el código de empleado {$values['employee_code']}.");
        }
    }

    private function matchTraveler(object $account, array $values): ?object
    {
        $query = DB::table('crm_corporate_travelers')->where('account_id', $account->id);

        return match (true) {
            $values['doc_number'] !== null => (clone $query)->where('doc_type', $values['doc_type'])->where('doc_number', $values['doc_number'])->first(),
            $values['employee_code'] !== null => (clone $query)->where('employee_code', $values['employee_code'])->first(),
            $values['email'] !== null => (clone $query)->where('email', $values['email'])->first(),
            default => null,
        };
    }

    private function readFile(UploadedFile $file): array
    {
        $extension = Str::lower($file->getClientOriginalExtension());

        try {
            $raw = $extension === 'xlsx' ? $this->xlsxRows((string) $file->getRealPath()) : $this->csvRows((string) $file->getRealPath());
        } catch (Throwable) {
            throw ApiException::unprocessable('CORP_IMPORT_FILE', 'No pudimos leer el archivo. Sube un CSV o un Excel (.xlsx) con la primera fila de encabezados.');
        }

        $header = array_map(fn (mixed $cell): string => Str::of(Str::ascii((string) $cell))->lower()->trim()->replace(' ', '_')->toString(), array_shift($raw) ?? []);
        $rows = [];

        foreach ($raw as $cells) {
            $row = [];
            foreach ($header as $index => $column) {
                if (isset(self::IMPORT_COLUMNS[$column])) {
                    $row[self::IMPORT_COLUMNS[$column]] = trim((string) ($cells[$index] ?? ''));
                }
            }
            if (array_filter($row, fn (string $value): bool => $value !== '') !== []) {
                $rows[] = $row;
            }
        }

        return $rows;
    }

    private function csvRows(string $path): array
    {
        $content = (string) file_get_contents($path);
        $content = preg_replace('/^\xEF\xBB\xBF/', '', $content) ?? $content;
        $lines = preg_split('/\r\n|\r|\n/', trim($content)) ?: [];
        $delimiter = substr_count($lines[0] ?? '', ';') > substr_count($lines[0] ?? '', ',') ? ';' : ',';

        return array_map(fn (string $line): array => str_getcsv($line, $delimiter, '"', '\\'), $lines);
    }

    private function xlsxRows(string $path): array
    {
        $reader = new Reader;
        $reader->open($path);
        $rows = [];

        foreach ($reader->getSheetIterator() as $sheet) {
            foreach ($sheet->getRowIterator() as $row) {
                $rows[] = $row->toArray();
            }
            break;
        }

        $reader->close();

        return $rows;
    }

    private function amount(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (! is_numeric($value) || (float) $value < 0) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'El presupuesto debe ser un monto mayor o igual a cero.');
        }

        return number_format((float) $value, 2, '.', '');
    }

    private function travelerSummary(array $values): string
    {
        return implode(' · ', array_filter([(string) ($values['full_name'] ?? ''), isset($values['doc_number']) && $values['doc_number'] ? "{$values['doc_type']} {$values['doc_number']}" : null, $values['employee_code'] ?? null]));
    }
}
