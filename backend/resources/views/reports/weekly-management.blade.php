@php
    use App\Domain\Reports\Support\ReportFormat as F;
    $brand = $report['agency']['brand'];
    $accent = $report['agency']['accent'];
    $ink = $report['agency']['ink'];
    $soft = F::tint($brand, 0.92);
    $line = F::tint($ink, 0.86);
    $muted = F::tint($ink, 0.45);
@endphp
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Reporte semanal de gerencia · {{ $report['agency']['name'] }}</title>
<style>
    @page { margin: 96px 40px 56px 40px; }
    * { box-sizing: border-box; }
    body { font-family: 'DejaVu Sans', sans-serif; font-size: 9.5px; color: {{ $ink }}; line-height: 1.45; }
    header { position: fixed; top: -76px; left: 0; right: 0; height: 60px; }
    footer { position: fixed; bottom: -36px; left: 0; right: 0; height: 20px; font-size: 8px; color: {{ $muted }}; border-top: 1px solid {{ $line }}; padding-top: 6px; }
    .band { width: 100%; border-collapse: collapse; }
    .band td { vertical-align: middle; }
    .badge { width: 40px; height: 40px; border-collapse: collapse; }
    .badge td { width: 40px; height: 40px; background: {{ $brand }}; color: #fff; font-size: 15px; font-weight: bold; text-align: center; vertical-align: middle; border-radius: 10px; padding: 0; }
    .agency { font-size: 13px; font-weight: bold; padding-left: 12px; }
    .agency small { display: block; font-size: 8px; font-weight: normal; color: {{ $muted }}; }
    .stamp { text-align: right; font-size: 8px; color: {{ $muted }}; }
    .stamp strong { display: block; font-size: 10px; color: {{ $ink }}; }
    .rule { height: 3px; background: {{ $brand }}; margin-top: 10px; }
    .rule span { display: block; width: 28%; height: 3px; background: {{ $accent }}; }
    h1 { font-size: 20px; margin: 0 0 2px; letter-spacing: -0.3px; }
    .period { color: {{ $muted }}; font-size: 10px; margin-bottom: 16px; }
    h2 { font-size: 11px; margin: 20px 0 8px; color: {{ $ink }}; }
    h2 span { display: inline-block; width: 8px; height: 8px; background: {{ $brand }}; border-radius: 2px; margin-right: 6px; }
    .kpis { width: 100%; border-collapse: separate; border-spacing: 6px; margin: 0 -6px; }
    .kpi { width: 25%; background: #fff; border: 1px solid {{ $line }}; border-radius: 10px; padding: 10px 12px; vertical-align: top; }
    .kpi .label { font-size: 8px; color: {{ $muted }}; }
    .kpi .value { font-size: 15px; font-weight: bold; margin: 3px 0 2px; }
    .kpi .change { font-size: 7.5px; }
    .good { color: #1d7a4f; }
    .bad { color: #b3263e; }
    .neutral { color: {{ $muted }}; }
    .kpi.lead { background: {{ $soft }}; border-color: {{ F::tint($brand, 0.75) }}; }
    .grid { width: 100%; border-collapse: collapse; }
    .grid > tbody > tr > td { vertical-align: top; }
    .card { border: 1px solid {{ $line }}; border-radius: 10px; padding: 10px 12px; }
    table.list { width: 100%; border-collapse: collapse; }
    table.list th { text-align: left; font-size: 7.5px; color: {{ $muted }}; font-weight: normal; padding: 4px 6px; border-bottom: 1px solid {{ $line }}; }
    table.list td { padding: 5px 6px; border-bottom: 1px solid {{ F::tint($ink, 0.93) }}; }
    table.list tr:last-child td { border-bottom: none; }
    .num, table.list th.num { text-align: right; white-space: nowrap; }
    .bar { height: 9px; background: {{ $brand }}; border-radius: 3px; }
    .bar.alt { background: {{ $accent }}; }
    .track { background: {{ F::tint($ink, 0.95) }}; border-radius: 3px; }
    .empty { color: {{ $muted }}; padding: 8px 0; }
    .alert { border-left: 3px solid {{ $muted }}; background: {{ F::tint($ink, 0.96) }}; padding: 7px 10px; margin-bottom: 6px; border-radius: 0 8px 8px 0; }
    .alert.bad { border-left-color: {{ $brand }}; background: {{ $soft }}; color: {{ $ink }}; }
    .alert b { font-size: 12px; margin-right: 6px; }
    .pill { font-size: 7px; padding: 1px 6px; border-radius: 8px; background: {{ F::tint($accent, 0.88) }}; color: {{ $accent }}; }
    .total { font-size: 15px; font-weight: bold; }
    .page-break { page-break-before: always; }
</style>
</head>
<body>
<header>
    <table class="band">
        <tr>
            <td style="width:40px"><table class="badge"><tr><td>{{ $report['agency']['initials'] }}</td></tr></table></td>
            <td class="agency">{{ $report['agency']['name'] }}<small>{{ $report['agency']['legal_name'] }} · RUC {{ $report['agency']['ruc'] }}</small></td>
            <td class="stamp"><strong>Reporte semanal de gerencia</strong>Generado el {{ $report['period']['generated_at'] }}</td>
        </tr>
    </table>
    <div class="rule"><span></span></div>
</header>
<footer>
    <table class="band"><tr><td>{{ $report['agency']['name'] }} · Confidencial, uso interno de gerencia · Qhapaq Travel Suite</td></tr></table>
</footer>

<h1>Resumen de la semana</h1>
<div class="period">Del {{ $report['period']['label'] }} · comparado con la semana del {{ $report['period']['previous_label'] }}</div>

<table class="kpis">
    @foreach (array_chunk($report['kpis'], 4) as $row)
        <tr>
            @foreach ($row as $index => $kpi)
                <td class="kpi {{ $loop->parent->first && $index === 0 ? 'lead' : '' }}">
                    <div class="label">{{ $kpi['label'] }}</div>
                    <div class="value">{{ F::value($kpi) }}</div>
                    <div class="change {{ F::tone($kpi) }}">{{ F::change($kpi) }}</div>
                </td>
            @endforeach
        </tr>
    @endforeach
</table>

<h2><span></span>Ventas por día</h2>
<div class="card">
    <table class="list">
        @foreach ($report['days'] as $day)
            <tr>
                <td style="width:56px">{{ $day['label'] }}</td>
                <td><div class="track"><div class="bar" style="width: {{ $day['width'] }}%"></div></div></td>
                <td class="num" style="width:90px">{{ F::money($day['sales']) }}</td>
                <td class="num" style="width:60px; color: {{ $muted }}">{{ $day['count'] }} {{ $day['count'] === 1 ? 'reserva' : 'reservas' }}</td>
            </tr>
        @endforeach
    </table>
</div>

<table class="grid" style="margin-top: 4px">
    <tr>
        <td style="width:50%; padding-right:6px">
            <h2><span></span>Por canal</h2>
            <div class="card">
                @if ($report['channels'] === [])
                    <div class="empty">Sin ventas en la semana.</div>
                @else
                    <table class="list">
                        <tr><th>Canal</th><th class="num">Reservas</th><th class="num">Ventas</th></tr>
                        @foreach ($report['channels'] as $row)
                            <tr><td>{{ $row['label'] }}</td><td class="num">{{ $row['count'] }}</td><td class="num">{{ F::money($row['sales']) }}</td></tr>
                        @endforeach
                    </table>
                @endif
            </div>
        </td>
        <td style="width:50%; padding-left:6px">
            <h2><span></span>Por asesor</h2>
            <div class="card">
                @if ($report['advisors'] === [])
                    <div class="empty">Sin ventas en la semana.</div>
                @else
                    <table class="list">
                        <tr><th>Asesor</th><th class="num">Reservas</th><th class="num">Ventas</th></tr>
                        @foreach ($report['advisors'] as $row)
                            <tr><td>{{ $row['label'] }}</td><td class="num">{{ $row['count'] }}</td><td class="num">{{ F::money($row['sales']) }}</td></tr>
                        @endforeach
                    </table>
                @endif
            </div>
        </td>
    </tr>
</table>

@if ($report['products'] !== [])
    <h2><span></span>Productos más vendidos</h2>
    <div class="card">
        <table class="list">
            <tr><th>Producto</th><th class="num">Pasajeros</th><th class="num">Ventas</th></tr>
            @foreach ($report['products'] as $row)
                <tr><td>{{ $row['label'] }}</td><td class="num">{{ $row['count'] }}</td><td class="num">{{ F::money($row['sales']) }}</td></tr>
            @endforeach
        </table>
    </div>
@endif

<div class="page-break"></div>

<h1>Cobranza y operación</h1>
<div class="period">Situación al {{ $report['period']['generated_at'] }}</div>

<table class="grid">
    <tr>
        <td style="width:34%; padding-right:6px">
            <div class="card" style="background: {{ $soft }}; border-color: {{ F::tint($brand, 0.75) }}">
                <div class="label" style="font-size:8px; color: {{ $muted }}">Por cobrar</div>
                <div class="total">{{ F::money($report['collection']['open']) }}</div>
                <div style="margin-top:6px; font-size:8px">Vencido: <b class="bad">{{ F::money($report['collection']['overdue']) }}</b></div>
            </div>
        </td>
        <td style="width:66%; padding-left:6px">
            <div class="card">
                <table class="list">
                    <tr><th>Antigüedad</th><th>&nbsp;</th><th class="num">Cuotas</th><th class="num">Saldo</th></tr>
                    @php $maxAging = max(array_map(fn ($row) => (float) $row['amount'], $report['collection']['aging']) ?: [0]); @endphp
                    @foreach ($report['collection']['aging'] as $index => $row)
                        <tr>
                            <td style="width:80px">{{ $row['label'] }}</td>
                            <td><div class="track"><div class="bar {{ $index === 0 ? 'alt' : '' }}" style="width: {{ $maxAging > 0 && (float) $row['amount'] > 0 ? max(2, (int) round((float) $row['amount'] / $maxAging * 100)) : 0 }}%"></div></div></td>
                            <td class="num" style="width:40px">{{ $row['count'] }}</td>
                            <td class="num" style="width:84px">{{ F::money($row['amount']) }}</td>
                        </tr>
                    @endforeach
                </table>
            </div>
        </td>
    </tr>
</table>

<h2><span></span>Viajes de los próximos 7 días</h2>
<div class="card">
    @if ($report['upcoming'] === [])
        <div class="empty">No hay viajes en los próximos 7 días.</div>
    @else
        <table class="list">
            <tr><th style="width:44px">Inicio</th><th style="width:96px">Reserva</th><th>Viaje</th><th>Cliente</th><th>Estado</th></tr>
            @foreach ($report['upcoming'] as $row)
                <tr><td>{{ $row['date'] }}</td><td>{{ $row['code'] }}</td><td>{{ $row['title'] }}</td><td>{{ $row['client'] }}</td><td><span class="pill">{{ $row['status'] }}</span></td></tr>
            @endforeach
        </table>
    @endif
</div>

<h2><span></span>Para atender esta semana</h2>
@if ($report['alerts'] === [])
    <div class="alert">Nada pendiente: sin incidencias abiertas, reclamos por vencer ni cotizaciones esperando respuesta.</div>
@else
    @foreach ($report['alerts'] as $alert)
        <div class="alert {{ $alert['tone'] === 'bad' ? 'bad' : '' }}"><b>{{ $alert['value'] }}</b>{{ $alert['label'] }} <span style="color: {{ $muted }}">· {{ $alert['note'] }}</span></div>
    @endforeach
@endif
</body>
</html>
