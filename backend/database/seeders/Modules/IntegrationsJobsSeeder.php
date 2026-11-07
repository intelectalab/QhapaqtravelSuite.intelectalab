<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use App\Domain\Shared\Jobs\JobCatalog;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class IntegrationsJobsSeeder
{
    use SeedsTenant;

    private const KINDS = ['Fiscal' => 'fiscal', 'Pagos' => 'payments', 'Email' => 'email', 'Mensajería' => 'messaging', 'Mapas' => 'maps', 'Proveedores' => 'suppliers', 'Distribución' => 'distribution'];

    private const OWNERS = ['fiscal' => 'U07', 'payments' => 'U07', 'email' => 'U01', 'messaging' => 'U01', 'maps' => 'U05', 'suppliers' => 'U05', 'distribution' => 'U01'];

    private const SOURCES = ['Job' => 'job', 'Notificación' => 'notification', 'Integración' => 'integration'];

    private const REPORTS = ['Finanzas y rentabilidad' => 'finanzas', 'Reservas' => 'reservas', 'Comercial' => 'comercial', 'Cotizaciones' => 'cotizaciones', 'Operaciones' => 'operaciones'];

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        $this->adapters();
        $this->jobs();
        $this->errors();
        $this->exports();
    }

    private function adapters(): void
    {
        foreach (KitSeeds::read('integrations') as $row) {
            $kind = self::KINDS[$row['kind']] ?? 'suppliers';
            $this->upsert('integration_adapters', ['code' => $row['id']], [
                'name' => $row['name'],
                'kind' => $kind,
                'status' => $row['status'],
                'environment' => $row['status'] === 'activo' ? 'production' : 'sandbox',
                'owner_user_id' => $this->userId(self::OWNERS[$kind]),
                'max_retries' => 5,
                'backoff_base_s' => 60,
                'timeout_s' => 30,
                'secret_ref' => in_array($row['status'], ['activo', 'sandbox', 'parcial'], true) ? 'vault://tenants/'.$this->tenant->code.'/'.strtolower($row['id']) : null,
                'note' => $row['note'],
                'created_by' => $this->userId('U01'),
                'updated_by' => $this->userId('U01'),
            ]);
        }
    }

    private function jobs(): void
    {
        foreach (KitSeeds::read('jobs') as $row) {
            $job = JobCatalog::TENANT[$row['id']] ?? null;

            if ($job === null) {
                continue;
            }

            [$class, $cron, $queue] = [$job['class'], $job['cron'], $job['queue']];
            $last = $this->moment($row['last']);
            $id = $this->upsert('sys_scheduled_jobs', ['code' => $row['id']], [
                'name' => $row['name'],
                'job_class' => $class,
                'cron' => $cron,
                'cron_label' => $row['cron'],
                'queue' => $queue,
                'paused' => false,
                'last_run_at' => $last,
                'next_run_at' => $this->moment($row['next']),
                'last_status' => $row['status'],
                'last_result' => $row['lastResult'],
                'is_system' => true,
            ]);

            $correlation = 'seed-'.strtolower($row['id']);
            DB::table('sys_job_runs')->where('scheduled_job_id', $id)->where('correlation_id', $correlation)->delete();

            if ($last !== null) {
                DB::table('sys_job_runs')->insert([
                    'tenant_id' => $this->tenant->getKey(),
                    'scheduled_job_id' => $id,
                    'job_class' => $class,
                    'trigger' => 'schedule',
                    'status' => $row['status'],
                    'result' => $row['lastResult'],
                    'started_at' => $last,
                    'finished_at' => Carbon::parse($last)->addSeconds(4)->toIso8601String(),
                    'attempt' => 1,
                    'correlation_id' => $correlation,
                ]);
            }
        }
    }

    private function errors(): void
    {
        foreach (KitSeeds::read('jobLog') as $row) {
            $status = $row['status'];
            $this->upsert('integration_errors', ['code' => $row['id']], [
                'source' => self::SOURCES[$row['source']] ?? 'job',
                'ref_code' => $row['ref'],
                'target' => $row['target'],
                'error' => $row['error'],
                'error_class' => strtolower($row['cls']),
                'attempt' => $row['attempt'],
                'max_attempts' => $row['max'],
                'next_retry_at' => $row['nextRetry'] !== '—' ? $this->moment($row['nextRetry']) : null,
                'status' => $status,
                'resolution' => $status === 'resuelto' ? 'Se resolvió en el reintento automático.' : null,
                'resolved_by' => null,
                'created_at' => $this->moment($row['ts']),
                'updated_at' => $this->moment($row['ts']),
            ]);
        }
    }

    private function exports(): void
    {
        foreach (KitSeeds::read('exports') as $row) {
            $at = $this->moment($row['ts']);
            $this->upsert('report_exports', ['code' => $row['id']], [
                'report_name' => $row['report'],
                'report_key' => self::REPORTS[$row['report']] ?? 'comercial',
                'filters' => '{}',
                'scope' => 'filtered',
                'format' => $row['format'],
                'rows_count' => $row['rows'],
                'size_bytes' => (int) round((float) $row['size'] * 1024),
                'status' => $row['status'],
                'requested_by' => $this->userId($row['user']),
                'created_by' => $this->userId($row['user']),
                'created_at' => $at,
                'finished_at' => $at,
                'expires_at' => Carbon::parse($at)->addDays(7)->toIso8601String(),
            ]);
        }
    }
}
