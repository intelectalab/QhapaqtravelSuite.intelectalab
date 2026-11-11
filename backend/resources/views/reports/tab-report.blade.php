@php
    use App\Domain\Reports\Support\ReportFile;
    use App\Domain\Reports\Support\ReportFormat as F;
    $brand = $agency['brand'];
    $accent = $agency['accent'];
    $ink = $agency['ink'];
    $soft = F::tint($brand, 0.93);
    $line = F::tint($ink, 0.86);
    $muted = F::tint($ink, 0.45);
    $numeric = ['money', 'percent', 'number', 'hours', 'days', 'rating'];
@endphp
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Reporte {{ $report['title'] }} · {{ $agency['name'] }}</title>
<style>
    @page { margin: 92px 36px 52px 36px; }
    * { box-sizing: border-box; }
    body { font-family: 'DejaVu Sans', sans-serif; font-size: 8.5px; color: {{ $ink }}; line-height: 1.4; }
    header { position: fixed; top: -72px; left: 0; right: 0; height: 56px; }
    footer { position: fixed; bottom: -34px; left: 0; right: 0; height: 18px; font-size: 7.5px; color: {{ $muted }}; border-top: 1px solid {{ $line }}; padding-top: 5px; }
    .band { width: 100%; border-collapse: collapse; }
    .band td { vertical-align: middle; }
    .badge { width: 36px; height: 36px; border-collapse: collapse; }
    .badge td { width: 36px; height: 36px; background: {{ $brand }}; color: #fff; font-size: 13px; font-weight: bold; text-align: center; vertical-align: middle; padding: 0; }
    .agency { font-size: 12px; font-weight: bold; padding-left: 10px; }
    .agency small { display: block; font-size: 7.5px; font-weight: normal; color: {{ $muted }}; }
    .stamp { text-align: right; font-size: 7.5px; color: {{ $muted }}; }
    .stamp strong { display: block; font-size: 9.5px; color: {{ $ink }}; }
    .rule { height: 3px; background: {{ $brand }}; margin-top: 9px; }
    .rule span { display: block; width: 28%; height: 3px; background: {{ $accent }}; }
    h1 { font-size: 18px; margin: 0 0 2px; }
    .scope { color: {{ $muted }}; font-size: 9px; margin-bottom: 14px; }
    h2 { font-size: 10.5px; margin: 18px 0 7px; }
    h2 span { display: inline-block; width: 7px; height: 7px; background: {{ $brand }}; margin-right: 5px; }
    .kpis { width: 100%; border-collapse: separate; border-spacing: 5px; margin: 0 -5px; }
    .kpi { width: 20%; border: 1px solid {{ $line }}; padding: 8px 10px; vertical-align: top; background: #fff; }
    .kpi .label { font-size: 7.5px; color: {{ $muted }}; }
    .kpi .value { font-size: 13px; font-weight: bold; margin: 3px 0 1px; }
    .kpi .hint { font-size: 7px; color: {{ $muted }}; }
    table.data { width: 100%; border-collapse: collapse; }
    table.data th { background: {{ $soft }}; color: {{ $ink }}; font-size: 7.5px; text-align: left; padding: 5px 6px; border-bottom: 1px solid {{ $line }}; }
    table.data td { padding: 4px 6px; border-bottom: 1px solid {{ $line }}; font-size: 8px; }
    table.data .num { text-align: right; white-space: nowrap; }
    table.data tr.total td { font-weight: bold; border-top: 1.5px solid {{ $ink }}; }
    .charts { width: 100%; border-collapse: separate; border-spacing: 8px; margin: 0 -8px; }
    .chart { width: 50%; vertical-align: top; border: 1px solid {{ $line }}; padding: 8px 10px; }
    .chart h3 { font-size: 8.5px; margin: 0 0 6px; }
    .bar { width: 100%; border-collapse: collapse; margin-bottom: 3px; }
    .bar td { font-size: 7.5px; padding: 0; vertical-align: middle; }
    .bar .name { width: 38%; color: {{ $muted }}; padding-right: 6px; }
    .bar .track { background: {{ $soft }}; height: 7px; }
    .bar .fill { background: {{ $brand }}; height: 7px; }
    .bar .amount { width: 22%; text-align: right; padding-left: 6px; }
    .empty { color: {{ $muted }}; font-size: 8px; padding: 10px 0; }
</style>
</head>
<body>
<header>
    <table class="band">
        <tr>
            <td style="width:36px"><table class="badge"><tr><td>{{ mb_strtoupper($agency['initials']) }}</td></tr></table></td>
            <td class="agency">{{ $agency['name'] }}<small>{{ $agency['legal_name'] }} · RUC {{ $agency['ruc'] }}</small></td>
            <td class="stamp"><strong>Reporte {{ $report['title'] }}</strong>Generado el {{ now()->timezone('America/Lima')->format('d/m/Y H:i') }}</td>
        </tr>
    </table>
    <div class="rule"><span></span></div>
</header>
<footer>
    <table class="band"><tr><td>{{ $agency['name'] }} · Confidencial, uso interno · KipuControl</td></tr></table>
</footer>

<h1>{{ $report['title'] }}</h1>
<div class="scope">{{ $scope }}</div>

<table class="kpis">
    <tr>
        @foreach ($report['kpis'] as $kpi)
            <td class="kpi">
                <div class="label">{{ $kpi['label'] }}</div>
                <div class="value">{{ ReportFile::cell($kpi['value'], $kpi['format']) }}</div>
                @if ($kpi['hint'])<div class="hint">{{ $kpi['hint'] }}</div>@endif
            </td>
        @endforeach
    </tr>
</table>

@if (count($report['charts']) > 0)
    <h2><span></span>Resumen gráfico</h2>
    <table class="charts">
        @foreach (array_chunk(array_values(array_filter($report['charts'], fn ($chart) => isset($chart['series'][0]['value']))), 2) as $pair)
            <tr>
                @foreach ($pair as $chart)
                    @php $max = max(array_map(fn ($point) => abs((float) ($point['value'] ?? 0)), $chart['series']) ?: [0]); @endphp
                    <td class="chart">
                        <h3>{{ $chart['title'] }}</h3>
                        @forelse (array_slice($chart['series'], 0, 8) as $point)
                            <table class="bar">
                                <tr>
                                    <td class="name">{{ mb_strimwidth((string) $point['label'], 0, 28, '…') }}</td>
                                    <td><div class="track"><div class="fill" style="width: {{ $max > 0 ? round(abs((float) $point['value']) / $max * 100, 1) : 0 }}%"></div></div></td>
                                    <td class="amount">{{ ReportFile::cell($point['value'], $chart['format']) }}</td>
                                </tr>
                            </table>
                        @empty
                            <div class="empty">Sin datos en el periodo.</div>
                        @endforelse
                    </td>
                @endforeach
                @if (count($pair) === 1)<td></td>@endif
            </tr>
        @endforeach
    </table>
@endif

<h2><span></span>Detalle</h2>
@if (count($report['table']['rows']) === 0)
    <div class="empty">No hay registros en el periodo elegido.</div>
@else
    <table class="data">
        <thead>
            <tr>
                @foreach ($report['table']['columns'] as $column)
                    <th class="{{ in_array($column['format'], $numeric, true) ? 'num' : '' }}">{{ $column['label'] }}</th>
                @endforeach
            </tr>
        </thead>
        <tbody>
            @foreach ($report['table']['rows'] as $row)
                <tr>
                    @foreach ($report['table']['columns'] as $column)
                        <td class="{{ in_array($column['format'], $numeric, true) ? 'num' : '' }}">{{ ReportFile::cell($row[$column['key']] ?? null, $column['format']) }}</td>
                    @endforeach
                </tr>
            @endforeach
            @if ($report['table']['totals'])
                <tr class="total">
                    @foreach ($report['table']['columns'] as $column)
                        <td class="{{ in_array($column['format'], $numeric, true) ? 'num' : '' }}">{{ ReportFile::cell($report['table']['totals'][$column['key']] ?? null, $column['format']) }}</td>
                    @endforeach
                </tr>
            @endif
        </tbody>
    </table>
@endif
</body>
</html>
