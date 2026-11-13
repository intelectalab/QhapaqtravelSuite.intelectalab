@extends('documents.layout')

@if ($document['state'] === 'void')
    @section('watermark', 'Anulada')
@endif

@section('styles')
    .issuer td { vertical-align: top; padding: 0; }
    .ruc-box { border: 1.5px solid {{ $agency['brand'] }}; border-radius: 10px; text-align: center; padding: 10px 12px; }
    .ruc-box .ruc { font-size: 10px; font-weight: bold; }
    .ruc-box .kind { font-size: 11px; font-weight: bold; color: {{ $agency['brand'] }}; margin: 4px 0; }
    .ruc-box .number { font-size: 12px; font-weight: bold; letter-spacing: 0.4px; }
@endsection

@section('content')
    <table class="grid issuer">
        <tr>
            <td style="width: 62%; padding-right: 14px">
                <div style="font-size: 13px; font-weight: bold">{{ $agency['legal_name'] }}</div>
                <div style="margin-top: 4px">{{ $agency['address'] }}</div>
                <div class="muted">{{ implode(' · ', array_filter([$agency['email'], $agency['web']])) }}</div>
            </td>
            <td style="width: 38%">
                <div class="ruc-box">
                    <div class="ruc">RUC {{ $agency['ruc'] }}</div>
                    <div class="kind">{{ $document['kind'] }}</div>
                    <div class="number">{{ $document['code'] }}</div>
                </div>
            </td>
        </tr>
    </table>

    <table class="facts" style="margin-top: 14px">
        <tr>
            <td style="width: 40%"><span class="label">Cliente</span><span class="value">{{ $customer['name'] }}</span><br><span class="muted">RUC {{ $customer['ruc'] }}</span></td>
            <td style="width: 20%"><span class="label">Emisión</span><span class="value">{{ $document['issue_date'] }}</span></td>
            <td style="width: 20%"><span class="label">Vencimiento</span><span class="value">{{ $document['due_date'] }}</span></td>
            <td style="width: 20%"><span class="label">Estado</span><span class="value">{{ $document['state_label'] }}</span></td>
        </tr>
    </table>
    @if ($customer['address'])
        <p class="muted" style="margin: 6px 0 0">Domicilio fiscal: {{ $customer['address'] }}</p>
    @endif
    <p class="muted" style="margin: 4px 0 0">{{ $document['concept'] }} · periodo {{ $document['period'] }} · moneda {{ $document['currency'] }}</p>

    <h2><span></span>Detalle</h2>
    <div class="card">
        <table class="list">
            <tr>
                <th style="width: 44px">Cant.</th>
                <th>Descripción</th>
                <th class="num" style="width: 96px">Precio unitario</th>
                <th class="num" style="width: 96px">Importe</th>
            </tr>
            @foreach ($lines as $row)
                <tr>
                    <td>{{ $row['quantity'] }}</td>
                    <td>{{ $row['description'] }}</td>
                    <td class="num">{{ $row['unit_price'] }}</td>
                    <td class="num">{{ $row['amount'] }}</td>
                </tr>
            @endforeach
        </table>
        <table class="totals">
            @foreach ($totals as $row)
                <tr><td class="muted">{{ $row['label'] }}</td><td class="num">{{ $row['value'] }}</td></tr>
            @endforeach
            <tr class="grand"><td>Importe total</td><td class="num">{{ $grand_total }}</td></tr>
        </table>
    </div>

    @if ($document['paid_at'])
        <div class="note keep" style="margin-top: 12px">Pagada el {{ $document['paid_at'] }}.</div>
    @endif
    @if ($document['sunat'] !== 'accepted')
        <div class="note brand keep">Representación impresa de la factura de suscripción. La validación ante SUNAT figura como pendiente.</div>
    @endif
@endsection
