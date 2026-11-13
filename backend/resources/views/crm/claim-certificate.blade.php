@extends('documents.layout')

@section('content')
    <h1>{{ $claim['type'] }} {{ $claim['number'] }}</h1>
    <p class="lede">Libro de Reclamaciones · {{ $claim['sede'] }} · registrada el {{ $claim['received_at'] }} ({{ $claim['channel'] }})</p>

    <table class="facts">
        <tr>
            <td><span class="label">Número de hoja</span><span class="value">{{ $claim['number'] }}</span></td>
            <td><span class="label">Tipo</span><span class="value">{{ $claim['type'] }}</span></td>
            <td><span class="label">Plazo de respuesta</span><span class="value">{{ $claim['due_date'] ?? 'Sin plazo' }}</span></td>
            <td><span class="label">Estado</span><span class="value">{{ $claim['status'] }}</span></td>
        </tr>
    </table>

    <table class="grid" style="margin-top: 12px">
        <tr>
            <td style="width: 50%; padding-right: 6px">
                <div class="card">
                    <h3>Consumidor</h3>
                    <p>{{ $consumer['name'] }}</p>
                    @if ($consumer['doc_number'])<p class="muted">{{ strtoupper((string) $consumer['doc_type']) }} {{ $consumer['doc_number'] }}</p>@endif
                    @if ($consumer['address'])<p class="muted">{{ $consumer['address'] }}</p>@endif
                    @if ($consumer['email'])<p class="muted">{{ $consumer['email'] }}</p>@endif
                    @if ($consumer['guardian'])<p class="muted">Apoderado: {{ $consumer['guardian']['name'] }} ({{ $consumer['guardian']['relation'] }})</p>@endif
                </div>
            </td>
            <td style="width: 50%; padding-left: 6px">
                <div class="card">
                    <h3>Bien contratado</h3>
                    @if ($good)
                        <p>{{ $good['kind'] }}: {{ $good['description'] }}</p>
                        @if ($good['amount'])<p class="muted">Monto reclamado: {{ $good['amount'] }}</p>@endif
                    @else
                        <p class="muted">No indicado.</p>
                    @endif
                </div>
            </td>
        </tr>
    </table>

    <h2><span></span>Detalle</h2>
    <div class="note">{{ $claim['detail'] }}</div>

    <h2><span></span>Pedido del consumidor</h2>
    <div class="note">{{ $claim['request'] }}</div>

    @if ($response)
        <h2><span></span>Respuesta del proveedor</h2>
        <p class="muted">{{ $response['decision'] }}@if ($response['answered_at']) · {{ $response['answered_at'] }}@endif</p>
        <div class="note brand">{{ $response['text'] }}</div>
        @if ($response['actions'])<p class="muted">Acciones adoptadas: {{ $response['actions'] }}</p>@endif
    @endif

    <p class="muted small" style="margin-top: 22px">La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una denuncia ante el INDECOPI. El proveedor responde en el plazo legal indicado.</p>
@endsection
