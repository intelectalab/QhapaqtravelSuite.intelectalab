<?php

declare(strict_types=1);

namespace App\Domain\Site\Support;

use App\Domain\Admin\Support\TenantSettings;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use stdClass;

final class SiteContent
{
    public const LEGAL = ['terminos', 'privacidad', 'cookies', 'cancelacion'];

    private const PAGE_TYPES = ['Página', 'Página legal', 'Landing'];

    private const TITLE_PREFIX = '/^(Blog|Landing|Banner|Home)\s*[:—-]\s*/u';

    public function __construct(private readonly SiteProfile $profile, private readonly TenantSettings $settings) {}

    public function posts(): array
    {
        return $this->published()->where('c.type', 'Artículo')->orderByDesc('c.published_at')->get()
            ->map(fn (stdClass $row): array => $this->summary($row))->values()->all();
    }

    public function post(string $slug): array
    {
        $row = $this->published()->where('c.type', 'Artículo')->where('c.slug', $slug)->first()
            ?? throw ApiException::notFound('El artículo no existe o no está publicado.');

        return [
            ...$this->summary($row),
            'body' => $row->body,
            'seo' => ['title' => $row->seo_title, 'description' => $row->seo_description],
            'related' => $this->published()->where('c.type', 'Artículo')->where('c.slug', '<>', $slug)->orderByDesc('c.published_at')->limit(3)->get()
                ->map(fn (stdClass $other): array => $this->summary($other))->values()->all(),
        ];
    }

    public function page(string $slug): array
    {
        $row = $this->published()->whereIn('c.type', self::PAGE_TYPES)->where('c.slug', $slug)->first()
            ?? ($slug === 'cancelacion' ? $this->published()->where('c.type', 'Página legal')->where('c.slug', 'like', '%cancel%')->first() : null);

        if ($row !== null) {
            return ['slug' => $slug, 'title' => $this->title($row->title), 'type' => $row->type, 'body' => $row->body, 'source' => 'cms', 'updated_at' => $row->published_at, 'seo' => ['title' => $row->seo_title, 'description' => $row->seo_description]];
        }

        if (in_array($slug, self::LEGAL, true)) {
            return $this->legal($slug);
        }

        throw ApiException::notFound('La página no existe o no está publicada.');
    }

    public function content(string $slug): array
    {
        $row = $this->published()->where('c.slug', $slug)->first() ?? throw ApiException::notFound('El contenido no existe o no está publicado.');

        return ['slug' => $row->slug, 'title' => $this->title($row->title), 'type' => $row->type, 'channel' => $row->channel, 'body' => $row->body, 'published_at' => $row->published_at];
    }

    public function placement(string $placement): array
    {
        return $this->published()->where('c.placement', $placement)->orderByDesc('c.published_at')->get()
            ->map(fn (stdClass $row): array => ['slug' => $row->slug, 'title' => $this->title($row->title), 'type' => $row->type, 'body' => $row->body])->values()->all();
    }

    public function about(): array
    {
        $cms = $this->published()->whereIn('c.type', self::PAGE_TYPES)->where('c.slug', 'nosotros')->first();
        $reviews = DB::table('crm_own_reviews')->whereNull('deleted_at')->where('status', 'publicada')->selectRaw('avg(stars) as avg, count(*) as total')->first();

        return [
            'body' => $cms?->body,
            'stats' => [
                'products' => DB::table('catalog_products as p')->whereNull('p.deleted_at')->where('p.status', 'ACTIVE')
                    ->whereExists(fn ($query) => $query->from('catalog_product_channels as ch')->whereColumn('ch.product_id', 'p.id')->where('ch.channel', 'ecommerce')->where('ch.is_published', true))->count(),
                'destinations' => DB::table('catalog_products as p')->whereNull('p.deleted_at')->where('p.status', 'ACTIVE')->distinct()->count('p.primary_destination_id'),
                'trips' => DB::table('booking_reservations')->whereNull('deleted_at')->whereIn('status', ['completada', 'en_operacion', 'confirmada'])->count(),
                'rating' => $reviews && (int) $reviews->total > 0 ? ['avg' => round((float) $reviews->avg, 1), 'count' => (int) $reviews->total] : null,
            ],
        ];
    }

    private function legal(string $slug): array
    {
        $agency = $this->profile->show()['agency'];
        $policies = $this->settings->section('policies');
        $claimsDays = (int) (DB::table('crm_claim_book_settings')->value('response_days') ?? 15);
        $name = $agency['legal_name'] ?: $agency['name'];
        $contact = trim(implode(' · ', array_filter([$agency['email'], $agency['phone']])));
        $advance = (int) ($policies['advance_pct'] ?? 0);
        $balanceDays = (int) ($policies['balance_days_before'] ?? 0);

        $sections = match ($slug) {
            'terminos' => [
                'Términos y condiciones' => ["Estas condiciones rigen las reservas hechas en el sitio web de {$agency['name']}, operado por {$name}, RUC {$agency['ruc']}".($agency['registry'] ? ", {$agency['registry']}" : '').'.'],
                'La reserva' => ['La reserva queda confirmada con el pago del total o del adelanto que indica cada producto y con el número de reserva que enviamos por correo. Los precios son por persona, en la moneda mostrada, e incluyen los impuestos que correspondan.'],
                'Pagos y saldo' => [$advance > 0 && $advance < 100 ? "En las reservas asistidas por un asesor se abona el {$advance} % para confirmar y el saldo vence ".($balanceDays > 0 ? "{$balanceDays} días antes de la salida." : 'el día de la salida.') : 'Las reservas se confirman con el pago total.', 'En el sitio web, cada producto indica si admite adelanto, el porcentaje y la fecha de vencimiento del saldo.'],
                'Cambios' => [$policies['modify_text'] ?? 'Los cambios están sujetos a disponibilidad y a la diferencia de tarifa.'],
                'Cancelaciones' => [$policies['cancel_text'] ?? 'Las penalidades dependen de los días de anticipación con que se cancela.', 'Cada producto puede tener su propia política, que se muestra en su ficha antes de pagar.'],
                'No presentación' => [$policies['noshow_text'] ?? 'Si el pasajero no se presenta, el servicio se cobra completo.'],
                'Reembolsos' => [$policies['refund_text'] ?? 'Los reembolsos se hacen por el mismo medio de pago.'],
                'Reclamos' => ["Contamos con Libro de Reclamaciones virtual. Respondemos en un plazo máximo de {$claimsDays} días hábiles."],
            ],
            'privacidad' => [
                'Política de privacidad' => ["{$name}, RUC {$agency['ruc']}".($agency['address'] ? ", con domicilio en {$agency['address']}" : '').', trata tus datos personales conforme a la Ley N.° 29733, Ley de Protección de Datos Personales, y su reglamento.'],
                'Qué datos usamos' => ['- Datos de contacto: nombre, correo, teléfono y país.', '- Datos de los viajeros: documento de identidad, fecha de nacimiento, nacionalidad y restricciones alimentarias o de salud que nos indiques.', '- Datos de la compra: productos, fechas, pagos y comprobantes.'],
                'Para qué los usamos' => ['- Gestionar tu reserva, emitir vouchers y comprobantes, y coordinar con los proveedores del viaje.', '- Atender consultas, reclamos y solicitudes.', '- Enviarte el boletín solo si lo aceptaste; puedes darte de baja cuando quieras.'],
                'Con quién los compartimos' => ['Solo con los proveedores que prestan los servicios de tu viaje (hoteles, transporte, entradas, guías) y con las entidades que la ley exige, como SUNAT para los comprobantes.'],
                'Tus derechos' => ['Puedes ejercer tus derechos de acceso, rectificación, cancelación y oposición escribiendo a '.($contact !== '' ? $contact : 'nuestros canales de atención').' o desde «Mi cuenta» en el portal del cliente.'],
            ],
            'cookies' => [
                'Política de cookies' => ['Este sitio usa solo cookies técnicas, necesarias para que funcione. No usamos cookies de publicidad ni de seguimiento de terceros.'],
                'Cookies que usamos' => ['- Carrito: guarda los productos que agregas mientras compras.', '- Pedido: recuerda el pedido recién pagado para mostrar su confirmación.', '- Idioma: recuerda si navegas en español o en inglés.', '- Sesión: mantiene tu sesión iniciada en el portal del cliente.'],
                'Cómo controlarlas' => ['Puedes borrarlas desde la configuración de tu navegador. Si lo haces, se vaciará el carrito y tendrás que elegir el idioma otra vez.'],
            ],
            default => [
                'Política de cancelación' => [$policies['cancel_text'] ?? 'Las penalidades dependen de los días de anticipación con que se cancela.'],
                'Cambios de fecha' => [$policies['modify_text'] ?? 'Sujetos a disponibilidad y a la diferencia de tarifa.'],
                'No presentación' => [$policies['noshow_text'] ?? 'Si el pasajero no se presenta, el servicio se cobra completo.'],
                'Reembolsos' => [$policies['refund_text'] ?? 'Los reembolsos se hacen por el mismo medio de pago.'],
                'Por producto' => ['Algunos productos tienen condiciones propias (por ejemplo, trenes o entradas nominativas). Se muestran en la ficha de cada producto antes de pagar.'],
            ],
        };

        $body = [];
        foreach ($sections as $heading => $paragraphs) {
            $body[] = "## {$heading}";
            foreach ($paragraphs as $paragraph) {
                $body[] = $paragraph;
            }
            $body[] = '';
        }

        $titles = ['terminos' => 'Términos y condiciones', 'privacidad' => 'Política de privacidad', 'cookies' => 'Política de cookies', 'cancelacion' => 'Política de cancelación'];

        return ['slug' => $slug, 'title' => $titles[$slug], 'type' => 'Página legal', 'body' => trim(implode("\n", $body)), 'source' => 'agency', 'updated_at' => null, 'seo' => ['title' => $titles[$slug], 'description' => null]];
    }

    private function published(): Builder
    {
        $today = $this->profile->today()->toDateString();

        return DB::table('cms_contents as c')
            ->leftJoin('iam_users as u', 'u.id', '=', 'c.author_id')
            ->whereNull('c.deleted_at')
            ->where('c.status', 'publicado')
            ->where('c.channel', 'like', '%Web%')
            ->where(fn ($query) => $query->whereNull('c.valid_from')->orWhere('c.valid_from', '<=', $today))
            ->where(fn ($query) => $query->whereNull('c.valid_to')->orWhere('c.valid_to', '>=', $today))
            ->select(['c.slug', 'c.title', 'c.type', 'c.channel', 'c.body', 'c.seo_title', 'c.seo_description', 'c.published_at', 'c.placement', 'u.name as author']);
    }

    private function summary(stdClass $row): array
    {
        $lines = array_values(array_filter(array_map('trim', explode("\n", (string) $row->body)), fn (string $line): bool => $line !== '' && ! str_starts_with($line, '#') && ! str_starts_with($line, '- ')));
        $words = str_word_count(strip_tags((string) $row->body));

        return [
            'slug' => $row->slug,
            'title' => $this->title($row->title),
            'excerpt' => $row->seo_description ?: mb_strimwidth($lines[0] ?? '', 0, 220, '…'),
            'published_at' => $row->published_at,
            'author' => $row->author,
            'minutes' => max(1, (int) ceil($words / 200)),
        ];
    }

    private function title(string $title): string
    {
        return trim((string) preg_replace(self::TITLE_PREFIX, '', $title));
    }
}
