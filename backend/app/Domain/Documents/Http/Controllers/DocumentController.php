<?php

declare(strict_types=1);

namespace App\Domain\Documents\Http\Controllers;

use App\Domain\B2bPortal\Support\B2bAccount;
use App\Domain\Channels\Support\ChannelKit;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Documents\Actions\ClientDocuments;
use App\Domain\Documents\Support\DocumentStore;
use App\Domain\Iam\Models\User;
use App\Domain\Portal\Support\PortalAccount;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Site\Actions\SiteCheckout;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

final class DocumentController
{
    public function __construct(private readonly ClientDocuments $documents, private readonly DocumentStore $store) {}

    public function queueQuote(Request $request, string $code, int $version): JsonResponse
    {
        return response()->json(['data' => $this->documents->queueQuote($this->staffQuoteVersion($request, $code, $version))], 202);
    }

    public function quote(Request $request, string $code, int $version): Response|JsonResponse
    {
        return $this->respond($request, ClientDocuments::QUOTE, $this->staffQuoteVersion($request, $code, $version));
    }

    public function confirmation(Request $request, string $code): Response|JsonResponse
    {
        $user = $this->user($request);
        $reservation = Portfolio::scope(DB::table('booking_reservations')->whereNull('deleted_at'), $user, 'owner_id')->where('code', $code)->first()
            ?? throw Portfolio::missing($user, 'booking_reservations', $code, 'La reserva no existe.', 'Esta reserva');
        $this->documents->printableReservation($reservation);

        return $this->respond($request, ClientDocuments::CONFIRMATION, (string) $reservation->id);
    }

    public function opsVoucher(Request $request, string $code): Response|JsonResponse
    {
        $voucher = DB::table('ops_vouchers')->where('code', $code)->first() ?? throw ApiException::notFound('El voucher no existe.');
        $this->documents->liveVoucher($voucher);

        return $this->respond($request, ClientDocuments::VOUCHER, (string) $voucher->id);
    }

    public function invoice(Request $request, string $number, AuditLogger $audit): Response|JsonResponse
    {
        $invoice = DB::table('fin_invoices')->where('number', $number)->first() ?? throw ApiException::notFound('El comprobante no existe.');
        $this->documents->printableInvoice($invoice);
        $response = $this->respond($request, ClientDocuments::INVOICE, (string) $invoice->id);
        $audit->log('Comprobante', (string) $invoice->number, 'solicitar_pdf', null, (string) $invoice->status);

        return $response;
    }

    public function portalQuote(Request $request, string $code): Response|JsonResponse
    {
        $account = PortalAccount::of($this->user($request));

        if ($account->isPassenger()) {
            throw ApiException::forbidden('PORTAL_CUSTOMER_ONLY', 'Esta sección es para quien hizo la reserva.');
        }

        $quote = $account->quote($code);

        if ($quote->current_version_id === null) {
            throw ApiException::notFound('No encontramos esa propuesta en tu cuenta.');
        }

        return $this->respond($request, ClientDocuments::QUOTE, (string) $quote->current_version_id);
    }

    public function portalItinerary(Request $request, string $code): Response|JsonResponse
    {
        $reservation = PortalAccount::of($this->user($request))->reservation($code);
        $this->documents->printableReservation($reservation);

        return $this->respond($request, ClientDocuments::ITINERARY, (string) $reservation->id);
    }

    public function b2bVoucher(Request $request, string $code, ChannelKit $kit): Response|JsonResponse
    {
        $account = B2bAccount::of($this->user($request), $kit->today());
        $voucher = DB::table('ops_vouchers')->where('code', $code)->where('status', '<>', 'anulado')->whereIn('reservation_id', $account->reservations()->select('id'))->first()
            ?? throw ApiException::notFound('No encontramos ese voucher en tu agencia.');

        return $this->respond($request, ClientDocuments::VOUCHER, (string) $voucher->id);
    }

    public function publicVoucher(Request $request, string $code, string $voucher, SiteCheckout $checkout): Response|JsonResponse
    {
        $order = $checkout->authorize($code, $request->header('X-Order-Token'));
        $row = DB::table('ops_vouchers')->where('code', $voucher)->where('status', '<>', 'anulado')
            ->whereIn('reservation_id', DB::table('booking_reservations')->where('ecom_order_id', $order->id)->whereNull('deleted_at')->select('id'))
            ->first() ?? throw ApiException::notFound('No encontramos ese voucher en tu pedido.');

        return $this->respond($request, ClientDocuments::VOUCHER, (string) $row->id);
    }

    private function staffQuoteVersion(Request $request, string $code, int $version): string
    {
        $user = $this->user($request);
        $quote = Portfolio::scope(DB::table('quote_quotes')->whereNull('deleted_at'), $user, 'owner_id')->where('code', $code)->first(['id'])
            ?? throw Portfolio::missing($user, 'quote_quotes', $code, 'La cotización no existe.', 'Esta cotización');

        return (string) (DB::table('quote_versions')->where('quote_id', $quote->id)->where('version_no', $version)->value('id')
            ?? throw ApiException::notFound("La cotización no tiene una versión {$version}."));
    }

    private function respond(Request $request, string $kind, string $entityId): Response|JsonResponse
    {
        return $this->store->respond($this->documents->generate($kind, $entityId), $request);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
