@extends('documents.layout')

@section('content')
    <h1>{{ $trip['title'] }}</h1>
    <p class="lede">Propuesta preparada para {{ $client['name'] }} · emitida el {{ $document['issued_on'] }} · válida hasta el {{ $document['valid_until'] }}</p>

    <table class="facts">
        <tr>
            <td><span class="label">Fechas del viaje</span><span class="value">{{ $trip['dates'] }}</span></td>
            <td><span class="label">Duración</span><span class="value">{{ $trip['duration'] }}</span></td>
            <td><span class="label">Viajeros</span><span class="value">{{ $trip['travellers'] }}</span></td>
            <td><span class="label">Inversión total</span><span class="value" style="color: {{ $agency['brand'] }}">{{ $grand_total }}</span></td>
        </tr>
    </table>

    @include('documents.partials.parties')

    @if ($days !== [])
        <h2><span></span>Itinerario</h2>
        @include('documents.partials.itinerary', ['days' => $days])
    @endif

    <h2><span></span>Detalle de precios</h2>
    <div class="card keep">
        <table class="list">
            <tr>
                <th style="width: 62px">Fecha</th>
                <th>Servicio</th>
                <th style="width: 118px">Cantidad</th>
                <th class="num" style="width: 78px">Precio unitario</th>
                <th class="num" style="width: 82px">Importe</th>
            </tr>
            @foreach ($lines as $line)
                <tr>
                    <td class="nowrap">{{ $line['date'] }}</td>
                    <td><strong>{{ $line['name'] }}</strong><br><span class="muted small">Tarifa {{ mb_strtolower($line['segment']) }}</span></td>
                    <td>{{ $line['quantity'] }}</td>
                    <td class="num">{{ $line['unit'] }}</td>
                    <td class="num">{{ $line['total'] }}</td>
                </tr>
            @endforeach
        </table>
        <table class="totals">
            @foreach ($totals as $row)
                <tr><td class="muted">{{ $row['label'] }}</td><td class="num">{{ $row['value'] }}</td></tr>
            @endforeach
            <tr class="grand"><td>Total</td><td class="num">{{ $grand_total }}</td></tr>
        </table>
    </div>
    <p class="muted small" style="margin-top: 5px">{{ $currency_note }}</p>

    @if ($inclusions !== [])
        <h2><span></span>Qué incluye</h2>
        @include('documents.partials.inclusions', ['inclusions' => $inclusions])
    @endif

    <h2><span></span>Condiciones</h2>
    @include('documents.partials.policies', ['conditions' => $conditions, 'paymentTerms' => $payment_terms, 'policies' => $policies])

    <div class="note brand keep" style="margin-top: 16px">
        Los precios se mantienen hasta el {{ $document['valid_until'] }} y están sujetos a disponibilidad al confirmar. Para aprobar la propuesta, escríbenos o apruébala desde tu portal de cliente citando el código {{ $document['code'] }}.
    </div>
@endsection
