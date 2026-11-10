<table class="grid" style="margin-top: 12px">
    <tr>
        <td style="width: 50%; padding-right: 6px">
            <div class="card">
                <span class="label">{{ $clientLabel ?? 'Cliente' }}</span>
                <strong>{{ $client['name'] }}</strong>
                <div class="muted">{{ implode(' · ', array_filter([$client['document'], $client['email'], $client['phone']])) }}</div>
            </div>
        </td>
        <td style="width: 50%; padding-left: 6px">
            <div class="card">
                <span class="label">Tu asesor de viaje</span>
                @if ($advisor)
                    <strong>{{ $advisor['name'] }}</strong>
                    <div class="muted">{{ implode(' · ', array_filter([$advisor['email'], $advisor['phone']])) }}</div>
                @else
                    <strong>{{ $agency['name'] }}</strong>
                    <div class="muted">{{ implode(' · ', array_filter([$agency['email'], $agency['phone']])) }}</div>
                @endif
            </div>
        </td>
    </tr>
</table>
