@extends('documents.layout')

@section('content')
    <h1>{{ $trip['title'] }}</h1>
    <p class="lede">Reserva {{ $document['code'] }} a nombre de {{ $client['name'] }} · actualizada el {{ $document['updated_on'] }}</p>

    <table class="facts">
        <tr>
            <td><span class="label">Fechas del viaje</span><span class="value">{{ $trip['dates'] }}</span></td>
            <td><span class="label">Duración</span><span class="value">{{ $trip['duration'] }}</span></td>
            <td><span class="label">Viajeros</span><span class="value">{{ $trip['travellers'] }}</span></td>
            <td><span class="label">Estado</span><span class="value" style="color: {{ $agency['brand'] }}">{{ $document['status'] }}</span></td>
        </tr>
    </table>

    @include('documents.partials.parties', ['clientLabel' => 'Titular de la reserva'])

    <h2><span></span>Servicios reservados</h2>
    <div class="card">
        <table class="list">
            <tr>
                <th style="width: 62px">Fecha</th>
                <th style="width: 36px">Hora</th>
                <th>Servicio</th>
                <th style="width: 96px">Estado</th>
                <th style="width: 80px">Código</th>
            </tr>
            @foreach ($services as $service)
                <tr>
                    <td class="nowrap">{{ $service['date'] }}</td>
                    <td class="muted">{{ $service['time'] ?? '' }}</td>
                    <td>{{ $service['name'] }}</td>
                    <td><span class="pill {{ $service['confirmed'] ? 'ok' : '' }}">{{ $service['status'] }}</span></td>
                    <td class="small">{{ $service['confirmation'] ?? '—' }}</td>
                </tr>
            @endforeach
        </table>
    </div>

    <h2><span></span>Pasajeros</h2>
    @if ($passengers === [])
        <p class="muted">Aún no hay pasajeros registrados. Envíanos sus datos para completar la reserva.</p>
    @else
        <div class="card keep">
            <table class="list">
                <tr><th>Nombre</th><th style="width: 60px">Tipo</th><th style="width: 120px">Documento</th><th style="width: 140px">Alimentación</th></tr>
                @foreach ($passengers as $passenger)
                    <tr>
                        <td>{{ $passenger['name'] }}@if ($passenger['lead']) <span class="pill accent">Titular</span>@endif</td>
                        <td>{{ $passenger['type'] }}</td>
                        <td>{{ $passenger['document'] ?? 'Por completar' }}</td>
                        <td class="muted">{{ $passenger['diet'] ?: '—' }}</td>
                    </tr>
                @endforeach
            </table>
        </div>
        @if ($missing_passengers > 0)
            <p class="muted small" style="margin-top: 5px">Faltan los datos completos de {{ $missing_passengers === 1 ? '1 pasajero' : $missing_passengers.' pasajeros' }}. Envíalos a tu asesor antes del viaje.</p>
        @endif
    @endif

    <h2><span></span>Pagos</h2>
    <table class="grid keep">
        <tr>
            <td style="width: 32%; padding-right: 6px">
                <div class="card soft">
                    <span class="label">Total de la reserva</span>
                    <div style="font-size: 14px; font-weight: bold">{{ $payment['total'] }}</div>
                    <div style="margin-top: 6px">Pagado: <strong>{{ $payment['paid'] }}</strong></div>
                    <div>Saldo: <strong style="color: {{ $agency['brand'] }}">{{ $payment['balance'] }}</strong></div>
                </div>
            </td>
            <td style="width: 68%; padding-left: 6px">
                <div class="card">
                    @if ($payment['schedule'] === [])
                        <p class="muted">El cronograma de pagos se enviará con la confirmación de tu asesor.</p>
                    @else
                        <table class="list">
                            <tr><th>Concepto</th><th style="width: 62px">Vence</th><th class="num" style="width: 80px">Importe</th><th style="width: 66px">Estado</th></tr>
                            @foreach ($payment['schedule'] as $row)
                                <tr>
                                    <td>{{ $row['concept'] }}</td>
                                    <td class="nowrap">{{ $row['due'] }}</td>
                                    <td class="num">{{ $row['amount'] }}</td>
                                    <td><span class="pill {{ $row['settled'] ? 'ok' : '' }}">{{ $row['status'] }}</span></td>
                                </tr>
                            @endforeach
                        </table>
                    @endif
                </div>
            </td>
        </tr>
    </table>
    <p class="muted small" style="margin-top: 5px">{{ $payment['currency_note'] }}</p>

    @if ($policies !== [])
        <h2><span></span>Políticas de la reserva</h2>
        @include('documents.partials.policies', ['conditions' => null, 'paymentTerms' => null, 'policies' => $policies])
    @endif

    <div class="note keep" style="margin-top: 16px">
        Presenta este documento o el código {{ $document['code'] }} ante cualquier consulta. Los vouchers de cada servicio se emiten cuando el proveedor confirma y te llegan por correo y a tu portal.
    </div>
@endsection
