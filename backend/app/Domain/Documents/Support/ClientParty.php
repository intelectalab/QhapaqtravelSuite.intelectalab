<?php

declare(strict_types=1);

namespace App\Domain\Documents\Support;

use Illuminate\Support\Facades\DB;

final class ClientParty
{
    public function client(string $clientId): array
    {
        $client = DB::table('crm_clients')->where('id', $clientId)->first(['name', 'doc_type', 'doc_number', 'email', 'phone', 'city', 'country']);

        return [
            'name' => (string) ($client->name ?? ''),
            'document' => $client === null ? null : trim("{$client->doc_type} {$client->doc_number}"),
            'email' => $client->email ?? null,
            'phone' => $client->phone ?? null,
            'location' => $client === null ? null : (implode(', ', array_filter([$client->city, $client->country])) ?: null),
        ];
    }

    public function advisor(?string $userId): ?array
    {
        $user = $userId === null ? null : DB::table('iam_users')->where('id', $userId)->first(['name', 'email', 'phone']);

        return $user === null ? null : ['name' => (string) $user->name, 'email' => $user->email, 'phone' => $user->phone];
    }
}
