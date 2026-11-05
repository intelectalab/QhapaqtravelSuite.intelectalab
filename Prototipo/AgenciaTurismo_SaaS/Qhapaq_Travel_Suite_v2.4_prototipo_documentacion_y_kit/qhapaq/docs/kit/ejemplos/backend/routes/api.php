<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| routes/api.php — EXTRACTO de referencia (prefijo /api/v1 configurado en bootstrap/app.php)
|--------------------------------------------------------------------------
| Fuente de rutas, métodos, permisos e idempotencia: kit-ia/api/openapi.yaml.
|   POST /api/v1/quotes/{id}/convert  · operationId quotesConvert · x-permission reservations.create
|   · x-idempotency required · If-Match (lock_version) · x-phase 1
| El contrato nombra el parámetro `{id}`; aquí se usa `{quote}` para el route model binding
| (compare_contract.py no compara nombres de parámetros). El modelo acepta uuid o código (COT-2026-00191).
|
| Pila de middleware del grupo autenticado (spec 00 §11 fila 1):
|   correlation → auth:sanctum → tenant (ResolveTenant) → tenant.active → mfa → tenant.db (SetPostgresTenant)
|   → permissions.team (setPermissionsTeamId) → experience:backoffice → [idempotent] → permission:x → controlador
*/

use App\Domain\Quotes\Http\Controllers\QuoteConversionController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'tenant', 'tenant.active', 'mfa', 'tenant.db', 'permissions.team', 'throttle:api'])
    ->group(function (): void {

        // ------------------------------------------------------------ Back-office (experiencia backoffice)
        Route::middleware('experience:backoffice')->group(function (): void {

            // Rutas literales ANTES que las parametrizadas (/quotes/kpis antes de /quotes/{quote}) — api/README §3.
            // Route::get('quotes/kpis', QuoteKpisController::class)->middleware('permission:quotes.view');

            Route::post('quotes/{quote}/convert', QuoteConversionController::class)
                ->middleware(['idempotent', 'permission:reservations.create'])
                ->name('quotes.convert');

            // Route::get('reservations/{reservation}', [ReservationController::class, 'show'])
            //     ->middleware('permission:reservations.view');
        });

        // ------------------------------------------------------------ App del operador (abilities del token)
        // Route::prefix('mobile/operator')->middleware('experience:mobile')->group(function (): void {
        //     Route::post('actions', MobileActionController::class)->middleware('permission:operations.view');
        //     Route::post('sync', MobileSyncController::class)->middleware('permission:operations.view');
        // });
    });

// ---------------------------------------------------------------- Pública (sitio y widget): tenant por host/clave
// Route::prefix('public')->middleware(['widget.key', 'tenant', 'tenant.db', 'throttle:public'])->group(function (): void {
//     Route::post('quote', PublicQuoteController::class);
//     Route::post('bookings', PublicBookingController::class)->middleware('idempotent');
// });
