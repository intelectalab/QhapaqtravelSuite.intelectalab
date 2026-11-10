@extends('documents.layout')

@section('content')
    <h1>{{ $trip['title'] }}</h1>
    <p class="lede">Itinerario de la reserva {{ $document['code'] }} · actualizado el {{ $document['updated_on'] }}</p>

    <table class="facts">
        <tr>
            <td><span class="label">Fechas del viaje</span><span class="value">{{ $trip['dates'] }}</span></td>
            <td><span class="label">Duración</span><span class="value">{{ $trip['duration'] }}</span></td>
            <td><span class="label">Viajeros</span><span class="value">{{ $trip['travellers'] }}</span></td>
            <td><span class="label">Estado</span><span class="value" style="color: {{ $agency['brand'] }}">{{ $document['status'] }}</span></td>
        </tr>
    </table>

    <h2><span></span>Día a día</h2>
    @if ($days === [])
        <p class="muted">Tu asesor está terminando de armar el itinerario. Te avisaremos apenas esté listo.</p>
    @else
        @include('documents.partials.itinerary', ['days' => $days])
    @endif

    <h2><span></span>Contactos durante el viaje</h2>
    @include('documents.partials.parties', ['clientLabel' => 'Titular de la reserva'])
    <div class="note brand keep" style="margin-top: 10px">
        Ante cualquier imprevisto en el viaje llama a {{ $agency['name'] }}@if ($agency['phone']) al {{ $agency['phone'] }}@endif o escribe a {{ $agency['email'] }} indicando el código {{ $document['code'] }}. Los horarios pueden ajustarse por clima u operación; te avisaremos de cualquier cambio.
    </div>
@endsection
