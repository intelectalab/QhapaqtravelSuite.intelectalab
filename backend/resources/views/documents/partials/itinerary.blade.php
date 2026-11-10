@foreach ($days as $day)
    <div class="day">
        <table class="day-head">
            <tr>
                <td class="day-no"><span>Día {{ $day['number'] }}</span></td>
                <td class="day-title">{{ $day['title'] }}</td>
            </tr>
        </table>
        <table class="entries">
            @foreach ($day['entries'] as $entry)
                <tr>
                    <td class="time">{{ $entry['time'] ?? '' }}</td>
                    <td class="what">
                        <strong>{{ $entry['title'] }}</strong>
                        @if (! empty($entry['status']))
                            <span class="pill {{ ! empty($entry['confirmed']) ? 'ok' : '' }}">{{ $entry['status'] }}</span>
                        @endif
                        @if (! empty($entry['detail']))
                            <span class="detail">{{ $entry['detail'] }}</span>
                        @endif
                        @if (! empty($entry['reference']))
                            <span class="detail">{{ $entry['reference'] }}</span>
                        @endif
                        @if ($entry['steps'] !== [])
                            <table class="steps">
                                @foreach ($entry['steps'] as $step)
                                    <tr><td class="t">{{ $step['time'] ?? '' }}</td><td>{{ $step['text'] }}@if ($step['location'])<span class="muted"> · {{ $step['location'] }}</span>@endif</td></tr>
                                @endforeach
                            </table>
                        @endif
                    </td>
                </tr>
            @endforeach
        </table>
    </div>
@endforeach
