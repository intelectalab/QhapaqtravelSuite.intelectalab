<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use App\Domain\Admin\Support\StaffNotices;
use Illuminate\Support\Facades\DB;

final class AllotmentNotices
{
    public function __construct(private readonly StaffNotices $notices) {}

    public function toProvider(string $allotmentId, string $event, string $subject, string $message): ?string
    {
        $contract = DB::table('catalog_allotments as a')->join('catalog_providers as p', 'p.id', '=', 'a.provider_id')->where('a.id', $allotmentId)->first(['a.id', 'a.code', 'p.name', 'p.email']);

        if ($contract === null) {
            return null;
        }

        $agency = $this->notices->agency();

        return $this->notices->email($contract->email, $event, "{$subject} · {$contract->code} · {$agency}", "Hola, {$contract->name}:\n\n{$message}\n\nContrato de cupo {$contract->code}.\n\n{$agency}", 'catalog_allotment', $contract->id, 'provider');
    }
}
