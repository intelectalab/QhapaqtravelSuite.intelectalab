@extends('documents.layout')

@if ($document['state'] === 'anulado')
    @section('watermark', 'Anulado')
@endif

@section('styles')
    .issuer td { vertical-align: top; padding: 0; }
    .ruc-box { border: 1.5px solid {{ $agency['brand'] }}; border-radius: 10px; text-align: center; padding: 10px 12px; }
    .ruc-box .ruc { font-size: 10px; font-weight: bold; }
    .ruc-box .kind { font-size: 11px; font-weight: bold; color: {{ $agency['brand'] }}; margin: 4px 0; }
    .ruc-box .number { font-size: 12px; font-weight: bold; letter-spacing: 0.4px; }
    .words { border: 1px solid {{ \App\Domain\Documents\Support\DocumentFormat::tint($agency['ink'], 0.86) }}; border-radius: 8px; padding: 7px 10px; margin-top: 10px; font-size: 8px; }
@endsection

@section('content')
    <table class="grid issuer">
        <tr>
            <td style="width: 62%; padding-right: 14px">
                <div style="font-size: 13px; font-weight: bold">{{ $agency['legal_name'] }}</div>
                <div class="muted">{{ $agency['name'] }}</div>
                <div style="margin-top: 4px">{{ $agency['fiscal_address'] }}</div>
                <div class="muted">{{ implode(' · ', array_filter([$agency['phone'], $agency['email'], $agency['web']])) }}</div>
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
            <td style="width: 46%"><span class="label">Adquirente</span><span class="value">{{ $customer['name'] }}</span><br><span class="muted">{{ $customer['document_label'] }} {{ $customer['document'] }}</span></td>
            <td style="width: 18%"><span class="label">Fecha de emisión</span><span class="value">{{ $document['issue_date'] }}</span></td>
            <td style="width: 18%"><span class="label">Moneda</span><span class="value">{{ $document['currency'] }}</span>@if ($document['fx'])<br><span class="muted small">Tipo de cambio {{ $document['fx'] }}</span>@endif</td>
            <td style="width: 18%"><span class="label">Operación</span><span class="value">{{ $document['operation'] }}</span></td>
        </tr>
    </table>
    @if ($customer['address'])
        <p class="muted" style="margin: 6px 0 0">Domicilio del adquirente: {{ $customer['address'] }}@unless ($customer['domiciled']) · no domiciliado en el Perú @endunless</p>
    @endif

    @if ($modifies)
        <div class="note" style="margin-top: 10px">
            Documento que modifica: <strong>{{ $modifies['kind'] }} {{ $modifies['number'] }}</strong> del {{ $modifies['date'] }}@if ($modifies['reason']) · {{ $modifies['reason'] }}@endif
        </div>
    @endif

    <h2><span></span>Detalle</h2>
    <div class="card">
        <table class="list">
            <tr>
                <th style="width: 40px">Cant.</th>
                <th style="width: 58px">Unidad</th>
                <th>Descripción</th>
                <th class="num" style="width: 84px">Valor unitario</th>
                <th class="num" style="width: 70px">IGV</th>
                <th class="num" style="width: 84px">Valor de venta</th>
            </tr>
            @foreach ($lines as $row)
                <tr>
                    <td>{{ $row['quantity'] }}</td>
                    <td>{{ $row['unit'] }}</td>
                    <td>{{ $row['description'] }}</td>
                    <td class="num">{{ $row['unit_value'] }}</td>
                    <td class="num">{{ $row['tax'] }}</td>
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
    <div class="words"><strong>{{ $amount_in_words }}</strong></div>

    @if ($related !== [])
        <p class="muted" style="margin: 8px 0 0">{{ collect($related)->map(fn ($row) => $row['label'].' '.$row['value'])->implode(' · ') }}</p>
    @endif

    <table class="grid keep" style="margin-top: 16px">
        <tr>
            <td style="width: 96px; vertical-align: top; padding-right: 12px">
                <img src="{{ $document['qr'] }}" alt="" style="width: 92px; height: 92px">
            </td>
            <td style="vertical-align: top">
                <div class="note" style="margin: 0">
                    {{ $legend }}
                    @if ($document['operation'] === 'Exportación de servicios')
                        <br>Operación de exportación de servicios no gravada con el IGV.
                    @endif
                    @if ($document['hash'])
                        <br><span class="muted">Código hash: {{ $document['hash'] }}</span>
                    @endif
                </div>
            </td>
        </tr>
    </table>
    @if ($document['simulated'])
        <div class="note brand keep">Comprobante emitido con el operador electrónico de demostración: no tiene validez tributaria.</div>
    @endif
@endsection
