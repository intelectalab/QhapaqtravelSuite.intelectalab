<?php

declare(strict_types=1);

namespace App\Domain\Marketing\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class ConsentDirectory
{
    public const GRANT_SOURCES = [
        'Formulario web — casilla de marketing',
        'Newsletter web (doble opt-in)',
        'Checkout e-commerce — casilla',
        'Ficha física firmada en oficina',
        'Llamada grabada — consentimiento verbal',
        'WhatsApp opt-in (respuesta SÍ)',
        'Portal del cliente — preferencias',
        'Contrato corporativo / convenio',
    ];

    public const REVOKE_SOURCES = [
        'Enlace de baja en correo',
        'Respuesta BAJA por WhatsApp',
        'Solicitud ARCO (derecho de oposición)',
        'Portal del cliente — preferencias',
        'Solicitud verbal registrada por asesor',
    ];

    public const POLICY_VERSION = 'PDP-2026.1';

    private const HREFS = ['client' => '/crm/clientes/', 'lead' => '/crm/leads/'];

    public function __construct(private readonly ContactBook $contacts) {}

    public function contacts(User $viewer, ?string $type = null, ?string $consent = null): array
    {
        $records = $this->records()->groupBy(fn (array $record): string => "{$record['subject_type']}:{$record['subject_id']}");
        $events = $this->events()->groupBy('consent_code');

        $rows = $this->contacts->all()
            ->when($type !== null, fn (Collection $all) => $all->where('type', $type))
            ->map(function (array $contact) use ($records, $events): array {
                $own = $records->get("{$contact['type']}:{$contact['id']}", collect())->keyBy('channel');

                return [
                    'key' => "{$contact['type']}:{$contact['code']}",
                    'type' => $contact['type'],
                    'type_label' => $contact['type_label'],
                    'id' => $contact['id'],
                    'code' => $contact['code'],
                    'name' => $contact['name'],
                    'email' => $contact['email'],
                    'mobile' => $contact['mobile'],
                    'href' => isset(self::HREFS[$contact['type']]) ? self::HREFS[$contact['type']].$contact['code'] : null,
                    'email_consent' => $own->get('email'),
                    'whatsapp_consent' => $own->get('whatsapp'),
                    'history' => $own->pluck('code')->flatMap(fn (string $code) => $events->get($code, collect()))->sortByDesc('occurred_at')->values(),
                ];
            });

        if ($consent !== null) {
            $rows = $rows->filter(fn (array $row): bool => ($row["{$consent}_consent"]['status'] ?? null) === 'otorgado');
        }

        return [
            'contacts' => $rows->values(),
            'sources' => ['grant' => self::GRANT_SOURCES, 'revoke' => self::REVOKE_SOURCES, 'policy_version' => self::POLICY_VERSION],
            'can' => ['manage' => $viewer->can('marketing.campaigns.manage')],
        ];
    }

    public function records(?string $channel = null, ?string $status = null): Collection
    {
        return DB::table('mkt_consents as c')->leftJoin('mkt_campaigns as m', 'm.id', '=', 'c.revoke_campaign_id')
            ->when($channel !== null, fn ($query) => $query->where('c.channel', $channel))
            ->when($status !== null, fn ($query) => $query->where('c.status', $status))
            ->orderBy('c.code')
            ->get(['c.*', 'm.code as campaign_code'])
            ->map(fn (object $row): array => $this->record($row));
    }

    public function history(string $code): Collection
    {
        $consent = DB::table('mkt_consents')->where('code', $code)->first(['id']) ?? throw ApiException::notFound('El consentimiento no existe.');

        return $this->events($consent->id);
    }

    public function record(object $row): array
    {
        return [
            'code' => $row->code,
            'lock_version' => (int) $row->lock_version,
            'subject_type' => $row->subject_type,
            'subject_id' => $row->subject_id,
            'channel' => $row->channel,
            'status' => $row->status,
            'granted_at' => $row->granted_at,
            'source' => $row->source,
            'evidence' => $row->evidence,
            'policy_version' => $row->policy_version,
            'revoked_at' => $row->revoked_at,
            'revoke_source' => $row->revoke_source,
            'revoke_campaign' => $row->campaign_code ?? null,
        ];
    }

    private function events(?string $consentId = null): Collection
    {
        return DB::table('mkt_consent_events as e')->join('mkt_consents as c', 'c.id', '=', 'e.consent_id')->leftJoin('iam_users as u', 'u.id', '=', 'e.actor_id')
            ->when($consentId !== null, fn ($query) => $query->where('e.consent_id', $consentId))
            ->orderByDesc('e.occurred_at')
            ->get(['c.code as consent_code', 'c.channel', 'e.event', 'e.source', 'e.evidence', 'e.occurred_at', 'u.name as actor'])
            ->map(fn (object $row): array => [
                'consent_code' => $row->consent_code,
                'channel' => $row->channel,
                'event' => $row->event,
                'source' => $row->source,
                'evidence' => $row->evidence,
                'occurred_at' => $row->occurred_at,
                'actor' => $row->actor,
            ]);
    }
}
