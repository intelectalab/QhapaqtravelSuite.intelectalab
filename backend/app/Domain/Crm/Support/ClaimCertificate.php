<?php

declare(strict_types=1);

namespace App\Domain\Crm\Support;

use App\Domain\Documents\Support\AgencyLetterhead;
use App\Domain\Documents\Support\DocumentDraft;
use App\Domain\Documents\Support\DocumentStore;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Money\Decimal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class ClaimCertificate
{
    public function __construct(
        private readonly ClaimBookDirectory $directory,
        private readonly AgencyLetterhead $letterhead,
        private readonly DocumentStore $store,
        private readonly AuditLogger $audit,
    ) {}

    public function respond(string $key, Request $request): Response|JsonResponse
    {
        $claim = $this->directory->find($key);
        $agency = $this->letterhead->current();
        $zone = $agency['timezone'];
        $id = (string) DB::table('crm_cases')->where('is_book', true)->where('code', $claim['code'])->value('id');
        $good = $claim['good'];

        $draft = new DocumentDraft('claim_certificate', 'crm_cases', $id, 'crm.claim-certificate', "Constancia {$claim['book_number']}", "constancia-{$claim['book_number']}.pdf", [
            'agency' => $agency,
            'document' => ['kind' => 'Hoja de reclamación', 'reference' => $claim['book_number']],
            'claim' => [
                'number' => $claim['book_number'],
                'type' => $claim['type'],
                'sede' => $claim['sede'],
                'channel' => $claim['channel_label'],
                'received_at' => Carbon::parse((string) $claim['received_at'])->setTimezone($zone)->format('d/m/Y H:i'),
                'due_date' => $claim['due_date'] ? Carbon::parse((string) $claim['due_date'])->format('d/m/Y') : null,
                'detail' => $claim['detail'],
                'request' => $claim['request'],
                'status' => $claim['book_status_label'],
            ],
            'consumer' => $claim['consumer'],
            'good' => $good === null ? null : [
                'kind' => $good['kind'],
                'description' => $good['description'],
                'amount' => $good['amount'] > 0 ? Decimal::display((string) $good['amount'], (string) $good['currency']) : null,
            ],
            'response' => $claim['response'] && $claim['response']['text'] ? [
                'decision' => $claim['response']['decision'],
                'text' => $claim['response']['text'],
                'actions' => $claim['response']['actions'],
                'answered_at' => $claim['response']['answered_at'] ? Carbon::parse((string) $claim['response']['answered_at'])->setTimezone($zone)->format('d/m/Y') : null,
            ] : null,
        ]);

        $document = $this->store->store($draft);
        $this->audit->log('Libro de reclamaciones', (string) $claim['book_number'], 'descargar_constancia', null, $document->fileName);

        return $this->store->respond($document, $request);
    }
}
