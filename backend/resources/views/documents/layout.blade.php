@php
    use App\Domain\Documents\Support\DocumentFormat as F;
    $brand = $agency['brand'];
    $accent = $agency['accent'];
    $ink = $agency['ink'];
    $muted = F::tint($ink, 0.42);
    $line = F::tint($ink, 0.86);
    $hair = F::tint($ink, 0.93);
    $faint = F::tint($ink, 0.965);
    $soft = F::tint($brand, 0.93);
    $softLine = F::tint($brand, 0.78);
    $accentSoft = F::tint($accent, 0.9);
    $contact = array_filter([$agency['address'], $agency['phone'], $agency['email'], $agency['web']]);
@endphp
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>{{ $document['kind'] }} · {{ $document['reference'] }} · {{ $agency['name'] }}</title>
<style>
    @page { margin: 104px 44px 70px 44px; }
    * { box-sizing: border-box; }
    body { font-family: 'DejaVu Sans', sans-serif; font-size: 9px; color: {{ $ink }}; line-height: 1.5; }
    header { position: fixed; top: -84px; left: 0; right: 0; height: 64px; }
    footer { position: fixed; bottom: -46px; left: 0; right: 0; height: 26px; font-size: 7px; color: {{ $muted }}; border-top: 1px solid {{ $line }}; padding-top: 7px; }
    table { border-collapse: collapse; }
    .band { width: 100%; }
    .band td { vertical-align: middle; padding: 0; }
    .badge { width: 38px; height: 38px; }
    .badge td { width: 38px; height: 38px; background: {{ $brand }}; color: #fff; font-size: 14px; font-weight: bold; text-align: center; vertical-align: middle; border-radius: 9px; }
    .agency { padding-left: 11px !important; font-size: 12.5px; font-weight: bold; letter-spacing: -0.1px; }
    .agency small { display: block; font-size: 7.5px; font-weight: normal; color: {{ $muted }}; letter-spacing: 0; }
    .doc { text-align: right; }
    .doc span { display: block; font-size: 7.5px; color: {{ $muted }}; }
    .doc strong { display: block; font-size: 11px; color: {{ $ink }}; }
    .rule { height: 2px; background: {{ $brand }}; margin-top: 12px; }
    .rule span { display: block; width: 22%; height: 2px; background: {{ $accent }}; }
    .foot td { vertical-align: top; padding: 0; }
    .foot .page { width: 90px; }
    h1 { font-size: 19px; line-height: 1.2; margin: 0 0 4px; letter-spacing: -0.3px; font-weight: bold; }
    .lede { font-size: 9.5px; color: {{ $muted }}; margin: 0 0 16px; }
    h2 { font-size: 10.5px; margin: 20px 0 8px; font-weight: bold; page-break-after: avoid; }
    h2 span { display: inline-block; width: 7px; height: 7px; background: {{ $brand }}; border-radius: 2px; margin-right: 6px; }
    h3 { font-size: 9.5px; margin: 0 0 4px; font-weight: bold; }
    .muted { color: {{ $muted }}; }
    .small { font-size: 7.5px; }
    .num { text-align: right; white-space: nowrap; }
    .nowrap { white-space: nowrap; }
    .facts { width: 100%; border: 1px solid {{ $line }}; border-radius: 10px; }
    .facts td { width: 25%; padding: 9px 12px; vertical-align: top; border-right: 1px solid {{ $hair }}; }
    .facts td:last-child { border-right: none; }
    .label { display: block; font-size: 7px; color: {{ $muted }}; margin-bottom: 2px; }
    .value { font-size: 9.5px; font-weight: bold; }
    .grid { width: 100%; }
    .grid > tbody > tr > td { vertical-align: top; padding: 0; }
    .card { border: 1px solid {{ $line }}; border-radius: 10px; padding: 10px 12px; }
    .card.soft { background: {{ $soft }}; border-color: {{ $softLine }}; }
    .card p { margin: 0; }
    table.list { width: 100%; }
    table.list th { text-align: left; font-size: 7px; font-weight: normal; color: {{ $muted }}; padding: 5px 7px; border-bottom: 1px solid {{ $line }}; }
    table.list td { padding: 6px 7px; border-bottom: 1px solid {{ $hair }}; vertical-align: top; }
    table.list tr:last-child td { border-bottom: none; }
    table.list th.num, table.list td.num { text-align: right; }
    .totals { width: 46%; margin-left: 54%; margin-top: 8px; }
    .totals td { padding: 4px 7px; }
    .totals .grand td { border-top: 1px solid {{ $line }}; padding-top: 8px; font-size: 12px; font-weight: bold; }
    .totals .grand td.num { color: {{ $brand }}; }
    .pill { display: inline-block; vertical-align: middle; margin-left: 3px; font-size: 7px; padding: 1px 7px; border-radius: 8px; background: {{ $faint }}; color: {{ $muted }}; white-space: nowrap; }
    .pill.ok { background: #e6f3ec; color: #1d6b45; }
    .pill.brand { background: {{ $soft }}; color: {{ $brand }}; }
    .pill.accent { background: {{ $accentSoft }}; color: {{ $accent }}; }
    .day { page-break-inside: avoid; margin-bottom: 9px; }
    .day-head { width: 100%; }
    .day-head td { padding: 0 0 4px; vertical-align: bottom; }
    .day-no { width: 40px; }
    .day-no span { display: inline-block; font-size: 7px; font-weight: bold; color: #fff; background: {{ $accent }}; border-radius: 6px; padding: 2px 6px; }
    .day-title { font-size: 9.5px; font-weight: bold; }
    .entries { width: 100%; border-left: 2px solid {{ $softLine }}; margin-left: 6px; }
    .entries td { padding: 4px 8px; vertical-align: top; }
    .entries .time { width: 40px; color: {{ $muted }}; font-size: 8px; white-space: nowrap; }
    .entries .what strong { font-size: 9px; }
    .entries .what .detail { display: block; color: {{ $muted }}; font-size: 7.5px; }
    .steps { margin: 3px 0 0; padding: 0; }
    .steps td { padding: 1px 6px 1px 0; font-size: 7.5px; color: {{ $ink }}; border: none; }
    .steps td.t { width: 32px; color: {{ $muted }}; }
    .bullets { margin: 0; padding: 0 0 0 11px; }
    .bullets li { margin: 0 0 2px; }
    .policy { width: 100%; }
    .policy td { padding: 5px 0; border-bottom: 1px solid {{ $hair }}; vertical-align: top; }
    .policy tr:last-child td { border-bottom: none; }
    .policy td.k { width: 110px; font-weight: bold; padding-right: 10px; }
    .note { border-left: 3px solid {{ $accent }}; background: {{ $faint }}; padding: 7px 10px; border-radius: 0 8px 8px 0; margin: 8px 0; }
    .note.brand { border-left-color: {{ $brand }}; background: {{ $soft }}; }
    .keep { page-break-inside: avoid; }
    .watermark { position: fixed; top: 300px; left: 40px; right: 40px; text-align: center; font-size: 74px; font-weight: bold; color: {{ $brand }}; opacity: 0.09; transform: rotate(-24deg); }
    @yield('styles')
</style>
</head>
<body>
<header>
    <table class="band">
        <tr>
            <td style="width: 38px"><table class="badge"><tr><td>{{ $agency['initials'] }}</td></tr></table></td>
            <td class="agency">{{ $agency['name'] }}<small>{{ $agency['legal_name'] }} · RUC {{ $agency['ruc'] }}</small></td>
            <td class="doc"><span>{{ $document['kind'] }}</span><strong>{{ $document['reference'] }}</strong></td>
        </tr>
    </table>
    <div class="rule"><span></span></div>
</header>
<footer>
    <table class="band foot">
        <tr>
            <td>{{ implode(' · ', $contact) }}@if ($agency['registry'])<br>{{ $agency['registry'] }}@endif</td>
            <td class="page"></td>
        </tr>
    </table>
</footer>
@hasSection('watermark')
    <div class="watermark">@yield('watermark')</div>
@endif
@yield('content')
</body>
</html>
