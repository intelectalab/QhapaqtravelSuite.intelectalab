<?php

declare(strict_types=1);

namespace App\Domain\Platform\Actions;

use App\Domain\Platform\Models\Plan;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Support\PlanCatalog;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class UpdatePlan
{
    private const CONNECTION = 'pgsql_platform';

    public function __construct(private readonly PlatformSession $session) {}

    public function __invoke(Plan $plan, array $data, PlatformUser $actor): void
    {
        $month = (float) $data['price_month'];
        $year = (float) $data['price_year'];

        if ($year > $month * 12) {
            throw ApiException::unprocessable('PLN-BR-02', 'El precio anual no puede superar 12 mensualidades.');
        }

        $neighbors = Plan::on(self::CONNECTION)->whereIn('rank', [$plan->rank - 1, $plan->rank + 1])->get()->keyBy('rank');
        $lower = $neighbors[$plan->rank - 1] ?? null;
        $upper = $neighbors[$plan->rank + 1] ?? null;

        if (($lower && $month <= (float) $lower->price_month) || ($upper && $month >= (float) $upper->price_month)) {
            throw ApiException::unprocessable('PLN-BR-01', 'El precio debe mantener el orden de los planes: más que '.($lower?->name ?? 'el anterior').' y menos que '.($upper?->name ?? 'el siguiente').'.');
        }

        DB::connection(self::CONNECTION)->transaction(function () use ($plan, $data, $month, $year, $actor): void {
            $limits = DB::connection(self::CONNECTION)->table('plan_limits')->where('plan_id', $plan->getKey())->pluck('value', 'metric');
            $before = $this->summary((float) $plan->price_month, $limits->all());

            $plan->forceFill([
                'price_month' => $month,
                'price_year' => $year,
                'trial_days' => (int) $data['trial_days'],
                'support_level' => $data['support_level'] ?? $plan->support_level,
                'updated_by' => $actor->getKey(),
            ])->save();

            foreach (PlanCatalog::METRICS as $metric) {
                $value = $data['limits'][$metric] ?? null;
                DB::connection(self::CONNECTION)->table('plan_limits')->updateOrInsert(['plan_id' => $plan->getKey(), 'metric' => $metric], ['value' => $value, 'hard' => true]);
            }

            $this->session->log('Plan', $plan->name, 'editar_plan', $before, $this->summary($month, $data['limits']), $actor);
        });
    }

    private function summary(float $price, array $limits): string
    {
        return 'S/ '.number_format($price, 0, '.', '').' · '.collect(PlanCatalog::METRICS)->map(fn (string $metric) => $metric.'='.(($limits[$metric] ?? null) === null ? '∞' : $limits[$metric]))->implode(' ');
    }
}
