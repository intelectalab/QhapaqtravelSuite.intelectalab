@if (! empty($conditions))
    <div class="note">{!! nl2br(e($conditions)) !!}</div>
@endif
@if (! empty($paymentTerms))
    <p style="margin: 6px 0 8px"><strong>Forma de pago.</strong> {{ $paymentTerms }}</p>
@endif
@if ($policies !== [])
    <table class="policy keep">
        @foreach ($policies as $policy)
            <tr><td class="k">{{ $policy['label'] }}</td><td>{{ $policy['text'] }}</td></tr>
        @endforeach
    </table>
@endif
