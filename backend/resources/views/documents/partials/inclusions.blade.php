@foreach ($inclusions as $group)
    <div class="card keep" style="margin-bottom: 8px">
        @if ($showProduct ?? true)
            <h3>{{ $group['product'] }}</h3>
        @endif
        <table class="grid">
            <tr>
                <td style="width: 50%; padding-right: 10px">
                    <span class="label">Incluye</span>
                    @if ($group['include'] === [])
                        <span class="muted">Sin detalle registrado.</span>
                    @else
                        <ul class="bullets">
                            @foreach ($group['include'] as $text)
                                <li>{{ $text }}</li>
                            @endforeach
                        </ul>
                    @endif
                </td>
                <td style="width: 50%; padding-left: 10px">
                    <span class="label">No incluye</span>
                    @if ($group['exclude'] === [])
                        <span class="muted">Sin exclusiones registradas.</span>
                    @else
                        <ul class="bullets">
                            @foreach ($group['exclude'] as $text)
                                <li class="muted">{{ $text }}</li>
                            @endforeach
                        </ul>
                    @endif
                </td>
            </tr>
        </table>
    </div>
@endforeach
