@extends('documents.layout')

@section('styles')
    .signatures { width: 100%; margin-top: 34px; }
    .signatures td { width: 25%; padding: 0 8px; vertical-align: bottom; text-align: center; }
    .signatures .line { border-top: 1px solid #9aa0b4; padding-top: 5px; }
@endsection

@section('content')
    <h1>{{ $count['kind'] }} · {{ $account['name'] }}</h1>
    <p class="lede">Acta {{ $count['code'] }} · {{ $count['counted_at'] }}@if ($account['sede']) · {{ $account['sede'] }}@endif</p>

    <table class="facts">
        <tr>
            <td><span class="label">Según sistema</span><span class="value">{{ $count['expected'] }}</span></td>
            <td><span class="label">Efectivo contado</span><span class="value">{{ $count['counted'] }}</span></td>
            <td><span class="label">Diferencia</span><span class="value" style="color: {{ $count['balanced'] ? '#1d6b45' : $agency['brand'] }}">{{ $count['difference'] }}</span></td>
            <td><span class="label">Resultado</span><span class="value">{{ $count['result'] }}</span></td>
        </tr>
    </table>

    <table class="grid" style="margin-top: 12px">
        <tr>
            <td style="width: 50%; padding-right: 6px">
                <div class="card">
                    <h3>Caja</h3>
                    <p>{{ $account['name'] }} ({{ $account['code'] }})</p>
                    @if ($account['custodian'])<p class="muted">Custodia: {{ $account['custodian'] }}</p>@endif
                    @if ($account['fund'])<p class="muted">Fondo fijo: {{ $account['fund'] }}</p>@endif
                </div>
            </td>
            <td style="width: 50%; padding-left: 6px">
                <div class="card">
                    <h3>Estado del acta</h3>
                    <p>{{ $count['status'] }}</p>
                    @if ($session)<p class="muted">Sesión {{ $session['code'] }} abierta el {{ $session['opened_at'] }} con {{ $session['opening'] }}</p>@endif
                </div>
            </td>
        </tr>
    </table>

    <h2><span></span>Conteo por denominación</h2>
    @if (count($denominations) === 0)
        <p class="muted">No se contó efectivo.</p>
    @else
        <table class="list">
            <thead>
                <tr><th>Denominación</th><th>Tipo</th><th class="num">Cantidad</th><th class="num">Subtotal</th></tr>
            </thead>
            <tbody>
                @foreach ($denominations as $row)
                    <tr><td>{{ $row['value'] }}</td><td class="muted">{{ $row['kind'] }}</td><td class="num">{{ $row['quantity'] }}</td><td class="num">{{ $row['subtotal'] }}</td></tr>
                @endforeach
            </tbody>
        </table>
        <table class="totals">
            <tr><td>Según sistema</td><td class="num">{{ $count['expected'] }}</td></tr>
            <tr><td>Diferencia</td><td class="num">{{ $count['difference'] }}</td></tr>
            <tr class="grand"><td>Total contado</td><td class="num">{{ $count['counted'] }}</td></tr>
        </table>
    @endif

    @if ($count['note'] || $count['approve_note'])
        <h2><span></span>Observaciones</h2>
        @if ($count['note'])<div class="note">{{ $count['note'] }}</div>@endif
        @if ($count['approve_note'])<div class="note brand">Aprobación: {{ $count['approve_note'] }}</div>@endif
    @endif

    <table class="signatures keep">
        <tr>
            @foreach ($signatures as $signature)
                <td>
                    <div class="line">
                        <strong>{{ $signature['name'] ?? 'Sin registrar' }}</strong><br>
                        <span class="muted small">{{ $signature['role'] }}@if ($signature['at']) · {{ $signature['at'] }}@endif</span>
                    </div>
                </td>
            @endforeach
        </tr>
    </table>
@endsection
