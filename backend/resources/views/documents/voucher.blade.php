@extends('documents.layout')

@if ($document['state'] === 'utilizado')
    @section('watermark', 'Utilizado')
@endif

@section('content')
    <h1>{{ $service['name'] }}</h1>
    <p class="lede">{{ $reservation['title'] }} · reserva {{ $reservation['code'] }} · emitido el {{ $document['issued_at'] }}</p>

    <table class="facts">
        <tr>
            <td><span class="label">Fecha del servicio</span><span class="value">{{ $service['date'] }}</span></td>
            <td><span class="label">Hora</span><span class="value">{{ $service['time'] ?? 'Por coordinar' }}</span></td>
            <td><span class="label">Pasajeros</span><span class="value">{{ $service['pax'] }}</span></td>
            <td><span class="label">Estado</span><span class="value" style="color: {{ $agency['brand'] }}">{{ $document['status'] }}</span></td>
        </tr>
    </table>

    <table class="grid" style="margin-top: 12px">
        <tr>
            <td style="width: 50%; padding-right: 6px">
                <div class="card soft">
                    <table class="grid">
                        <tr>
                            <td style="vertical-align: top">
                                <span class="label">Código de confirmación del proveedor</span>
                                <div style="font-size: 15px; font-weight: bold; letter-spacing: 0.6px">{{ $service['confirmation'] ?? 'Pendiente' }}</div>
                                <span class="label" style="margin-top: 8px">Código de verificación del voucher</span>
                                <div style="font-size: 10px; font-weight: bold; letter-spacing: 1px">{{ $document['verification'] }}</div>
                            </td>
                            <td style="width: 78px; vertical-align: top; text-align: right">
                                <img src="{{ $document['qr'] }}" alt="" style="width: 74px; height: 74px">
                            </td>
                        </tr>
                    </table>
                </div>
            </td>
            <td style="width: 50%; padding-left: 6px">
                <div class="card">
                    <span class="label">Proveedor</span>
                    <strong>{{ $provider['name'] }}</strong>@if ($provider['type']) <span class="muted">· {{ $provider['type'] }}</span>@endif
                    <div class="muted">{{ implode(' · ', array_filter([$provider['contact'], $provider['phone'], $provider['email']])) }}</div>
                    @if ($service['meeting'])
                        <span class="label" style="margin-top: 8px">Punto de encuentro</span>
                        <div>{{ $service['meeting'] }}@if ($service['return'])<span class="muted"> · retorno en {{ $service['return'] }}</span>@endif</div>
                    @endif
                </div>
            </td>
        </tr>
    </table>

    @if ($crew !== [])
        <h2><span></span>Guía y transporte</h2>
        <div class="card keep">
            <table class="list">
                @foreach ($crew as $member)
                    <tr><td style="width: 80px" class="muted">{{ $member['label'] }}</td><td><strong>{{ $member['name'] }}</strong></td><td class="num">{{ $member['phone'] ?? '' }}</td></tr>
                @endforeach
            </table>
        </div>
    @endif

    <h2><span></span>Pasajeros</h2>
    <div class="card keep">
        @if ($passengers === [])
            <p class="muted">Los nombres de los pasajeros se confirman con la reserva {{ $reservation['code'] }}.</p>
        @else
            <table class="list">
                <tr><th>Nombre</th><th style="width: 60px">Tipo</th><th style="width: 120px">Documento</th></tr>
                @foreach ($passengers as $passenger)
                    <tr>
                        <td>{{ $passenger['name'] }}@if ($passenger['lead']) <span class="pill accent">Titular</span>@endif</td>
                        <td>{{ $passenger['type'] }}</td>
                        <td>{{ $passenger['document'] ?? '—' }}</td>
                    </tr>
                @endforeach
            </table>
        @endif
    </div>

    @if ($diets !== [])
        <h2><span></span>Alimentación y cuidados</h2>
        <div class="card keep">
            <ul class="bullets">
                @foreach ($diets as $passenger)
                    <li><strong>{{ $passenger['name'] }}:</strong> {{ $passenger['diet'] }}</li>
                @endforeach
            </ul>
        </div>
    @endif

    @if ($inclusions)
        <h2><span></span>Qué incluye el servicio</h2>
        @include('documents.partials.inclusions', ['inclusions' => [$inclusions], 'showProduct' => false])
    @endif

    @if ($service['note'])
        <div class="note">{{ $service['note'] }}</div>
    @endif

    <div class="note brand keep" style="margin-top: 14px">
        @php
            $help = array_filter([
                'Asistencia de '.$agency['name'].($agency['phone'] ? ' al '.$agency['phone'] : ''),
                $agency['email'],
                $advisor ? 'tu asesor '.$advisor['name'].($advisor['phone'] ? ' ('.$advisor['phone'].')' : '') : null,
            ]);
        @endphp
        Presenta este voucher, impreso o en el celular, al proveedor el día del servicio. {{ implode(' · ', $help) }}.
    </div>
@endsection
