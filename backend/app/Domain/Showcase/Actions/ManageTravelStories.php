<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Actions;

use App\Domain\Admin\Support\NotificationLog;
use App\Domain\Iam\Models\User;
use App\Domain\Portal\Support\PortalAccount;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ManageTravelStories
{
    public const NAME_MODES = ['nombre_completo', 'solo_nombre', 'anonimo'];

    public function __construct(private readonly AuditLogger $audit, private readonly NotificationLog $notifications) {}

    public function create(array $data, User $actor): array
    {
        $reservation = DB::table('booking_reservations')->where('code', $data['reservation'])->whereNull('deleted_at')->first(['id', 'code', 'client_id'])
            ?? throw ApiException::unprocessable('VT-STORY', 'Elige una reserva de la lista.', ['field' => 'reservation']);
        $id = (string) Str::uuid7();
        $slug = $this->slug($data['slug'] ?? null, (string) $data['title']);
        DB::table('cms_travel_stories')->insert([
            'id' => $id,
            'slug' => $slug,
            'client_id' => $reservation->client_id,
            'reservation_id' => $reservation->id,
            'product_id' => $this->product($data['product'] ?? null),
            ...$this->fields($data),
            'status' => 'borrador',
            'created_by' => $actor->getKey(),
        ]);
        $this->audit->log('Aventura', $slug, 'crear', null, "{$data['title']} · {$reservation->code}");

        return ['id' => $id, 'slug' => $slug, 'status' => 'borrador'];
    }

    public function update(string $id, array $data): array
    {
        $story = $this->find($id);
        $merged = [
            'title' => $data['title'] ?? $story->title,
            'city' => array_key_exists('city', $data) ? $data['city'] : $story->city,
            'quote' => array_key_exists('quote', $data) ? $data['quote'] : $story->quote,
            'body' => array_key_exists('body', $data) ? $data['body'] : $story->body,
            'photo_count' => $data['photo_count'] ?? $story->photo_count,
        ];

        if ($story->status === 'publicado' && (int) $merged['photo_count'] > 0 && ! $story->consent_photos) {
            throw ApiException::unprocessable('VT-12', 'El cliente no autorizó fotos: deja la historia sin fotos o pide un nuevo consentimiento.', ['field' => 'photo_count']);
        }

        DB::table('cms_travel_stories')->where('id', $story->id)->update([
            ...$this->fields($merged),
            'product_id' => array_key_exists('product', $data) ? $this->product($data['product']) : $story->product_id,
            'updated_at' => now(),
        ]);
        $this->audit->log('Aventura', (string) $story->slug, 'editar', (string) $story->title, (string) $merged['title']);

        return ['id' => $story->id, 'status' => $story->status];
    }

    public function delete(string $id): void
    {
        $story = $this->find($id);

        if ($story->status === 'publicado') {
            throw ApiException::conflict('VT-STORY', 'Despublica la historia antes de eliminarla.');
        }

        DB::table('cms_travel_stories')->where('id', $story->id)->delete();
        $this->audit->log('Aventura', (string) $story->slug, 'eliminar', $story->status, null);
    }

    public function requestConsent(string $id, User $actor): array
    {
        $story = $this->find($id);

        if ($story->status === 'publicado') {
            throw ApiException::conflict('VT-12', 'La historia ya está publicada con consentimiento vigente.');
        }

        $client = DB::table('crm_clients')->where('id', $story->client_id)->first(['id', 'name', 'email']);

        if (blank($client?->email)) {
            throw ApiException::unprocessable('VT-12', 'El cliente no tiene correo registrado. Regístralo en su ficha o registra el consentimiento firmado.');
        }

        DB::table('cms_travel_stories')->where('id', $story->id)->update(['status' => 'pendiente_consentimiento', 'updated_at' => now()]);
        $this->notifications->record([
            'event_code' => 'aventura.consentimiento',
            'channel' => 'email',
            'recipient_address' => $client->email,
            'subject' => "¿Nos autoriza a publicar su historia «{$story->title}»?",
            'body_rendered' => "Hola {$client->name}: queremos contar su viaje en nuestro blog de aventuras. Puede autorizarlo, elegir cómo se muestra su nombre y si publicamos fotos desde su portal de cliente. Puede retirar la autorización cuando quiera.",
            'client_id' => $client->id,
            'reservation_id' => $story->reservation_id,
            'source_type' => 'cms_travel_stories',
            'source_id' => $story->id,
            'audience' => 'client',
            'created_by' => $actor->getKey(),
        ]);
        $this->audit->log('Aventura', (string) $story->slug, 'pedir_consentimiento', $story->status, (string) $client->email);

        return ['id' => $story->id, 'status' => 'pendiente_consentimiento', 'sent_to' => $client->email];
    }

    public function publish(string $id): array
    {
        $story = $this->find($id);

        if ($story->status === 'publicado') {
            throw ApiException::conflict('VT-12', 'La historia ya está publicada.');
        }

        if ($story->consent_at === null || $story->consent_revoked_at !== null) {
            throw ApiException::unprocessable('VT-12', 'Sin consentimiento vigente del cliente no se puede publicar. Pídelo desde la historia.');
        }

        if ((int) $story->photo_count > 0 && ! $story->consent_photos) {
            throw ApiException::unprocessable('VT-12', 'El cliente no autorizó fotos: quita las fotos antes de publicar.');
        }

        DB::table('cms_travel_stories')->where('id', $story->id)->update(['status' => 'publicado', 'published_at' => now(), 'updated_at' => now()]);
        $this->audit->log('Aventura', (string) $story->slug, 'publicar', $story->status, 'publicado');

        return ['id' => $story->id, 'status' => 'publicado', 'path' => '/aventuras/'.$story->slug];
    }

    public function unpublish(string $id, ?string $reason): array
    {
        $story = $this->find($id);

        if ($story->status !== 'publicado') {
            throw ApiException::conflict('VT-12', 'Solo se despublica una historia publicada.');
        }

        DB::table('cms_travel_stories')->where('id', $story->id)->update(['status' => 'despublicado', 'updated_at' => now()]);
        $this->audit->log('Aventura', (string) $story->slug, 'despublicar', 'publicado', trim('despublicado'.($reason ? " · {$reason}" : '')));

        return ['id' => $story->id, 'status' => 'despublicado'];
    }

    public function consent(PortalAccount $account, string $id, array $data): array
    {
        $story = Str::isUuid($id) ? DB::table('cms_travel_stories')->where('id', $id)->where('client_id', $account->client->id)->first() : null;

        if ($story === null) {
            throw ApiException::notFound('La historia no existe.');
        }

        if ($data['granted']) {
            DB::table('cms_travel_stories')->where('id', $story->id)->update([
                'consent_at' => now(),
                'consent_by_name' => mb_substr((string) $account->client->name, 0, 160),
                'consent_channel' => 'portal',
                'consent_name_mode' => $data['name_mode'] ?? 'solo_nombre',
                'consent_photos' => (bool) ($data['photos'] ?? false),
                'consent_revoked_at' => null,
                'status' => $story->status === 'borrador' ? 'pendiente_consentimiento' : ($story->status === 'publicado' && ! ($data['photos'] ?? false) && (int) $story->photo_count > 0 ? 'despublicado' : $story->status),
                'updated_at' => now(),
            ]);
            $this->audit->log('Aventura', (string) $story->slug, 'consentimiento', $story->consent_at ? 'vigente' : 'sin consentimiento', 'otorgado · '.($data['name_mode'] ?? 'solo_nombre').(! empty($data['photos']) ? ' · con fotos' : ' · sin fotos'));

            return ['id' => $story->id, 'consent' => 'otorgado'];
        }

        if ($story->consent_at === null || $story->consent_revoked_at !== null) {
            throw ApiException::conflict('VT-12', 'No hay un consentimiento vigente que retirar.');
        }

        DB::table('cms_travel_stories')->where('id', $story->id)->update([
            'consent_revoked_at' => now(),
            'status' => $story->status === 'publicado' ? 'despublicado' : $story->status,
            'updated_at' => now(),
        ]);
        $this->audit->log('Aventura', (string) $story->slug, 'retirar_consentimiento', $story->status, $story->status === 'publicado' ? 'despublicado' : $story->status);

        return ['id' => $story->id, 'consent' => 'retirado', 'status' => $story->status === 'publicado' ? 'despublicado' : $story->status];
    }

    private function fields(array $data): array
    {
        return [
            'title' => trim((string) $data['title']),
            'city' => blank($data['city'] ?? null) ? null : trim((string) $data['city']),
            'quote' => blank($data['quote'] ?? null) ? null : trim((string) $data['quote']),
            'body' => blank($data['body'] ?? null) ? null : (string) $data['body'],
            'photo_count' => (int) ($data['photo_count'] ?? 0),
        ];
    }

    private function product(?string $code): ?string
    {
        if (blank($code)) {
            return null;
        }

        return DB::table('catalog_products')->where('code', $code)->whereNull('deleted_at')->value('id') ?? throw ApiException::unprocessable('VT-STORY', 'Elige un producto del catálogo.', ['field' => 'product']);
    }

    private function find(string $id): object
    {
        $story = Str::isUuid($id) ? DB::table('cms_travel_stories')->where('id', $id)->first() : null;

        return $story ?? throw ApiException::notFound('La historia no existe.');
    }

    private function slug(?string $slug, string $title): string
    {
        $base = Str::limit(Str::slug($slug ?: $title), 150, '') ?: 'historia';
        $candidate = $base;
        $n = 2;

        while (DB::table('cms_travel_stories')->where('slug', $candidate)->exists()) {
            $candidate = $base.'-'.$n++;
        }

        return $candidate;
    }
}
