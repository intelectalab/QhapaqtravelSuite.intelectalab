<?php

declare(strict_types=1);

namespace App\Domain\Marketing\Support;

use App\Domain\Admin\Support\StaffNotices;
use Illuminate\Support\Facades\DB;

final class UnsubscribeConfirmation
{
    private const TABLES = ['client' => ['crm_clients', 'name'], 'lead' => ['crm_leads', 'full_name'], 'subscriber' => ['mkt_contacts_subscribers', 'full_name']];

    public function __construct(private readonly StaffNotices $notices) {}

    public function send(string $subjectType, string $subjectId, string $channel, ?string $consentId = null): ?string
    {
        [$table, $nameColumn] = self::TABLES[$subjectType] ?? [null, null];

        if ($table === null) {
            return null;
        }

        $contact = DB::table($table)->where('id', $subjectId)->first(['email', $nameColumn.' as name']);
        $agency = $this->notices->agency();
        $what = $channel === 'whatsapp' ? 'mensajes comerciales por WhatsApp' : 'ofertas y novedades por correo';
        $body = 'Hola'.($contact?->name ? ", {$contact->name}" : '').":\n\nConfirmamos tu baja: ya no recibirás {$what} de {$agency}. Los mensajes de tus reservas y viajes siguen llegando con normalidad.\n\nSi fue un error, puedes volver a suscribirte desde nuestro sitio.\n\n{$agency}";

        return $this->notices->email($contact?->email, 'marketing.baja_confirmada', "Confirmamos tu baja · {$agency}", $body, 'mkt_consent', $consentId, $subjectType === 'client' ? 'client' : 'client', $subjectType === 'client' ? ['client_id' => $subjectId] : []);
    }
}
