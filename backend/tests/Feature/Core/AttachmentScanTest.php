<?php

use App\Domain\Integrations\Adapters\ClamAvMalwareScanner;
use App\Domain\Integrations\Contracts\MalwareScanner;
use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Integrations\Fake\FakeMalwareScanner;
use App\Domain\Operations\Support\EvidenceStore;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Storage::fake(EvidenceStore::diskName());
    Storage::fake((string) config('filesystems.default'));
});

function scanJpeg(string $payload): UploadedFile
{
    return UploadedFile::fake()->createWithContent('llegada.jpg', "\xFF\xD8\xFF\xE0\x00\x10JFIF\x00".$payload.str_repeat('z', 256)."\xFF\xD9");
}

function scanUpload(UploadedFile $file): TestResponse
{
    return test()->withHeaders(['Accept' => 'application/json'])->post('/api/v1/ops/orders/OP-2026-0412/evidences/upload', ['file' => $file]);
}

it('una evidencia con malware se rechaza, no se guarda y queda auditada', function () {
    actingAsSeed('U05');
    $before = withinTenant(tenantA(), fn () => DB::table('ops_evidences')->count());

    expect(scanUpload(scanJpeg(FakeMalwareScanner::marker())))->toBeApiError(422, 'FILE_INFECTED')
        ->and(withinTenant(tenantA(), fn () => DB::table('ops_evidences')->count()))->toBe($before)
        ->and(Storage::disk(EvidenceStore::diskName())->allFiles())->toBe([])
        ->and(auditExists(['entity' => 'Evidencia', 'entity_id' => 'OP-2026-0412', 'action' => 'archivo_bloqueado']))->toBeTrue();

    scanUpload(scanJpeg('foto limpia'))->assertCreated();
});

it('si el antivirus no responde, la subida se rechaza sin guardar nada', function () {
    app()->instance(MalwareScanner::class, new class implements MalwareScanner
    {
        public function scan(string $contents): AdapterResult
        {
            return AdapterResult::transient('El antivirus no respondió.');
        }

        public function healthcheck(): AdapterResult
        {
            return AdapterResult::transient('El antivirus no respondió.');
        }
    });
    actingAsSeed('U05');

    expect(scanUpload(scanJpeg('foto')))->toBeApiError(409, 'FILE_SCAN_UNAVAILABLE')
        ->and(Storage::disk(EvidenceStore::diskName())->allFiles())->toBe([]);
});

it('la factura del proveedor con malware se rechaza antes de guardarse', function () {
    actingAsSeed('U17');
    $body = ['number' => 'f001-9001', 'issue_date' => '2026-09-28', 'amount' => 190, 'file_name' => 'F001-9001.pdf', 'file_content' => base64_encode("%PDF-1.4\n".FakeMalwareScanner::marker()."\n%%EOF")];

    expect($this->postJson('/api/v1/supplier/payables/CXP-00407/invoices', $body, critical()))->toBeApiError(422, 'FILE_INFECTED')
        ->and(Storage::disk((string) config('filesystems.default'))->allFiles())->toBe([]);
});

it('interpreta las respuestas de ClamAV', function () {
    expect(ClamAvMalwareScanner::interpret('stream: OK')->ok)->toBeTrue()
        ->and(ClamAvMalwareScanner::interpret('stream: Win.Test.EICAR_HDB-1 FOUND'))->status->toBe(MalwareScanner::INFECTED)
        ->and(ClamAvMalwareScanner::interpret('stream: Win.Test.EICAR_HDB-1 FOUND')->message)->toBe('Win.Test.EICAR_HDB-1')
        ->and(ClamAvMalwareScanner::interpret('INSTREAM size limit exceeded. ERROR')->errorClass)->toBe('transitorio');
});

it('ClamAV sin servidor alcanzable devuelve un error transitorio', function () {
    config(['services.clamav.host' => '127.0.0.1', 'services.clamav.port' => 1, 'services.clamav.timeout' => 1]);

    expect((new ClamAvMalwareScanner)->scan('hola')->errorClass)->toBe('transitorio');
});
