<?php

declare(strict_types=1);

namespace App\Domain\Channels\Actions;

use App\Domain\Channels\Support\ExternalReviewDirectory;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class SaveExternalReviewWidget
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function save(array $data, User $actor): array
    {
        $config = DB::table('channel_widget_config')->first(['id', 'defaults']) ?? throw ApiException::conflict('WEB-BR-01', 'El widget todavía no está configurado para esta agencia.');
        $connected = DB::table('integration_review_sources')->where('status', 'conectado')->pluck('provider')->all();
        $sources = array_values(array_unique($data['sources']));
        $offline = array_diff($sources, $connected);

        if ($offline !== []) {
            throw ValidationException::withMessages(['sources' => 'Solo se muestran reseñas de plataformas conectadas.']);
        }

        $defaults = json_decode((string) $config->defaults, true) ?: [];
        $before = ExternalReviewDirectory::widgetSettings($defaults, $connected);
        $after = ['sources' => $sources, 'min_rating' => (int) $data['min_rating'], 'count' => (int) $data['count'], 'layout' => $data['layout']];

        DB::table('channel_widget_config')->where('id', $config->id)->update([
            'defaults' => json_encode([...$defaults, 'reviews_widget' => $after], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);

        $this->audit->log('Widget de reseñas', 'configuracion', 'editar', self::text($before), self::text($after));

        return $after;
    }

    private static function text(array $settings): string
    {
        return implode(', ', $settings['sources'])." · desde {$settings['min_rating']} estrellas · {$settings['count']} · {$settings['layout']}";
    }
}
