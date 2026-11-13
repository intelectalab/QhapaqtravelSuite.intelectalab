@extends('documents.layout')

@if ($status === 'anulado')
    @section('watermark', 'ANULADO')
@endif

@section('content')
    <h1>Estado de cuenta · {{ $period }}</h1>
    <p class="lede">{{ $client['name'] }} · {{ $client['doc'] }} · {{ $range }}</p>

    <table class="facts">
        <tr>
            @foreach ($totals as $row)
                <td><span class="label">{{ $row['label'] }}</span><span class="value">{{ $row['value'] }}</span></td>
            @endforeach
        </tr>
    </table>

    <h2><span></span>Movimientos del mes</h2>
    <div class="card">
        <table class="list">
            <tr>
                <th style="width: 58px">Fecha</th>
                <th style="width: 74px">Tipo</th>
                <th style="width: 92px">Documento</th>
                <th>Detalle</th>
                <th style="width: 58px">C. costo</th>
                <th class="num" style="width: 74px">Cargo</th>
                <th class="num" style="width: 74px">Abono</th>
            </tr>
            @forelse ($lines as $line)
                <tr>
                    <td class="nowrap">{{ $line['date'] }}</td>
                    <td>{{ $line['kind'] }}</td>
                    <td class="nowrap">{{ $line['document'] }}</td>
                    <td>{{ $line['detail'] }}</td>
                    <td class="nowrap">{{ $line['cost_center'] }}</td>
                    <td class="num">{{ $line['charge'] }}</td>
                    <td class="num">{{ $line['credit'] }}</td>
                </tr>
            @empty
                <tr><td colspan="7" class="muted">Sin movimientos en el mes.</td></tr>
            @endforelse
        </table>
        <table class="totals">
            @foreach ($totals as $row)
                <tr><td class="muted">{{ $row['label'] }}</td><td class="num">{{ $row['value'] }}</td></tr>
            @endforeach
            <tr class="grand"><td>Saldo final</td><td class="num">{{ $closing }}</td></tr>
        </table>
    </div>

    <div class="note brand keep" style="margin-top: 16px">{{ $terms }}</div>
@endsection
