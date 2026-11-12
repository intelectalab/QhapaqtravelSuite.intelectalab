@extends('documents.layout')

@section('content')
    <h1>{{ $product['name'] }}</h1>
    <p class="lede">{{ implode(' · ', array_filter([$product['type'], $product['destination']])) }}@if ($product['summary']) — {{ $product['summary'] }}@endif</p>

    <table class="facts">
        <tr>
            <td><span class="label">Duración</span><span class="value">{{ $product['duration'] }}</span></td>
            <td><span class="label">Modalidad</span><span class="value">{{ $product['modality'] ?? '—' }}</span></td>
            <td><span class="label">Grupo</span><span class="value">{{ $product['group'] ?? 'A consultar' }}</span></td>
            <td><span class="label">Precio desde</span><span class="value" style="color: {{ $agency['brand'] }}">@if ($product['price']){{ $product['price']['currency'] }} {{ $product['price']['amount'] }}@else A consultar @endif</span></td>
        </tr>
    </table>

    @if ($product['description'])
        <p>{!! nl2br(e($product['description'])) !!}</p>
    @endif

    @if ($days !== [])
        <h2><span></span>Itinerario</h2>
        @include('documents.partials.itinerary', ['days' => $days])
    @endif

    @if ($inclusions !== [])
        <h2><span></span>Qué incluye</h2>
        @include('documents.partials.inclusions', ['inclusions' => $inclusions, 'showProduct' => false])
    @endif

    @if ($requirements !== [] || $product['min_age'])
        <h2><span></span>Requisitos y recomendaciones</h2>
        <ul class="bullets">
            @if ($product['min_age'])
                <li>Edad mínima: {{ $product['min_age'] }}.</li>
            @endif
            @foreach ($requirements as $text)
                <li>{{ $text }}</li>
            @endforeach
        </ul>
    @endif

    @if ($policies !== [])
        <h2><span></span>Políticas</h2>
        @include('documents.partials.policies', ['policies' => $policies, 'conditions' => null, 'paymentTerms' => null])
    @endif

    <div class="note brand keep" style="margin-top: 12px">
        Precio @if ($product['price']){{ $product['price']['basis'] }}, @endif sujeto a disponibilidad y temporada. Ficha actualizada el {{ $document['updated_on'] }}. Reserva con {{ $agency['name'] }}@if ($agency['phone']) al {{ $agency['phone'] }}@endif o escribe a {{ $agency['email'] }} indicando el código {{ $document['code'] }}.
    </div>
@endsection
