/**
 * Espejo en código de e2e/SELECTORES.md. Si cambias un data-testid, cámbialo en ambos sitios.
 * Convención: `{pantalla}-{elemento}` en kebab-case inglés; el sufijo dinámico va tras `:`
 * (código legible del registro o valor de dominio), p. ej. `table-row:COT-2026-00191`.
 */
const dyn = (base: string) => (v: string | number) => `${base}:${v}`;

export const T = {
  // ---------- Shell y transversales ----------
  shell: 'app-shell',
  pageTitle: 'page-title',
  navItem: dyn('nav-item'),              // nav-item:cotizaciones
  userMenu: 'user-menu',
  logout: 'user-menu-logout',
  toast: 'toast',                         // cualquier toast; data-variant=ok|bad|warn
  forbidden: 'forbidden-page',            // pantalla 403
  forbiddenPerms: 'forbidden-required-perms',
  forbiddenPath: 'forbidden-requested-path',
  forbiddenRequestAccess: 'forbidden-request-access',
  scopeDenied: 'scope-denied',            // «Registro fuera de su cartera»
  notFound: 'not-found-page',
  statusBadge: 'status-badge',            // data-status=<valor de dominio>
  statusStep: dyn('status-step'),         // status-step:aprobada (data-state=done|current|todo)
  dialog: 'dialog',
  dialogConfirm: 'dialog-confirm',
  dialogCancel: 'dialog-cancel',
  field: dyn('field'),                    // field:discount_pct  (= name del campo RHF/FormRequest)
  fieldError: dyn('field-error'),
  tableRow: dyn('table-row'),             // table-row:RES-2026-000348
  tableEmpty: 'table-empty',
  tableExport: 'table-export',
  filter: dyn('filter'),                  // filter:status
  tab: dyn('tab'),                        // tab:versiones
  kpi: dyn('kpi'),                        // kpi:ventas-mes
  action: dyn('action'),                  // botón de acción de negocio: action:convert
  option: dyn('option'),                  // opción de combobox/picker por código: option:RES-2026-000350, option:G01
  previewReadOnly: 'preview-readonly-banner', // vista previa interna de portales (H-05: sin escritura)

  // ---------- Login ----------
  loginEmail: 'login-email',
  loginPassword: 'login-password',
  loginSubmit: 'login-submit',
  loginError: 'login-error',
  mfaCode: 'mfa-code',
  mfaSubmit: 'mfa-submit',

  // ---------- CRM ----------
  leadTake: 'lead-take',
  leadActivityDone: dyn('lead-activity-done'),
  leadBant: dyn('lead-bant'),             // lead-bant:budget|authority|need|timing
  leadQualify: 'lead-qualify',
  leadConvert: 'lead-convert',
  leadConvertClientMode: dyn('lead-convert-client-mode'), // :new|:existing
  leadConvertClient: 'lead-convert-client',
  opportunityCreateQuote: 'opportunity-create-quote',
  timeline360: 'timeline-360',

  // ---------- Cotizaciones ----------
  quoteAddProduct: 'quote-add-product',
  quoteProductPicker: 'quote-product-picker',
  quoteProductOption: dyn('quote-product-option'), // :PRD-011
  quoteLine: dyn('quote-line'),           // quote-line:0
  quoteDiscount: 'quote-discount-pct',
  quoteTotal: 'quote-total',
  quoteMargin: 'quote-margin',
  quoteSave: 'quote-save',
  quoteApprovalBanner: 'quote-internal-approval-banner',
  quoteRequestApproval: 'quote-request-internal-approval',
  quoteInternalApprove: 'quote-internal-approve',
  quoteSend: 'quote-send',
  quoteSendChannel: dyn('quote-send-channel'), // :email|:whatsapp|:portal
  quoteRegisterApproval: 'quote-register-client-approval',
  quoteConvert: 'quote-convert',
  quoteConvertPreview: 'quote-convert-preview',
  quoteConvertConfirm: 'quote-convert-confirm',
  quoteReservationLink: 'quote-reservation-link',

  // ---------- Reservas ----------
  reservationCode: 'reservation-code',
  reservationTotal: 'reservation-total',
  reservationService: dyn('reservation-service'), // :SRV-… o índice
  reservationReceivable: dyn('reservation-receivable'), // :anticipo|:saldo|:penalidad
  reservationCancel: 'reservation-cancel',
  cancellationPenalty: 'cancellation-penalty',
  cancellationRefund: 'cancellation-refund',
  cancellationConfirm: 'cancellation-confirm',

  // ---------- Operaciones ----------
  orderCreate: 'order-create',
  orderServiceRequest: dyn('order-service-request'),
  orderServiceConfirm: dyn('order-service-confirm'),
  orderAssign: dyn('order-assign'),
  assignGuide: 'assign-guide',
  assignDriver: 'assign-driver',
  assignVehicle: 'assign-vehicle',
  assignWarningAck: 'assign-warning-ack',
  assignSave: 'assign-save',
  voucherIssue: dyn('voucher-issue'),
  voucherCode: dyn('voucher-code'),
  orderStepState: dyn('order-step'),      // order-step:checkin (data-state)
  orderCloseChecks: 'order-close-checks',
  orderClose: 'order-close',
  incidentSeverity: 'incident-severity',
  incidentResolve: 'incident-resolve',
  incidentClose: 'incident-close',
  incidentEvidence: 'incident-evidence',
  criticalAlert: 'critical-incident-alert',

  // ---------- Finanzas ----------
  paymentRegister: 'payment-register',
  paymentApply: 'payment-apply',
  invoiceIssue: 'invoice-issue',
  costRegister: 'cost-register',
  costApprove: 'cost-approve',
  profitMargin: 'profit-margin',
  settlement: 'settlement-open',

  // ---------- Portales ----------
  portalQuoteApprove: 'portal-quote-approve',
  portalQuoteAcceptTerms: 'portal-quote-accept-terms',
  portalQuoteApproverName: 'portal-quote-approver-name',
  portalQuoteStatus: 'portal-quote-status',
  paxAlert: dyn('pax-alert'),
  paxAlertMarkRead: dyn('pax-alert-read'),
  paxItineraryDay: dyn('pax-itinerary-day'),
  paxVoucherOpen: dyn('pax-voucher-open'),
  paxVoucherQr: 'pax-voucher-qr',

  // ---------- Motor de reservas: widget y checkout (esp. 15/16/17) ----------
  bkCalendar: 'bk-calendar',
  bkDay: dyn('bk-day'),                   // bk-day:2026-10-12 (data-status=disponible|cerrado|agotado|sin_cupo|fuera_de_plazo|no_opera)
  bkRangesSummary: 'bk-ranges-summary',
  bkRange: dyn('bk-range'),               // bk-range:RG-1101
  bkMonthNext: 'bk-month-next',
  bkPaxInc: dyn('bk-pax-inc'),            // :adt|:chd|:inf
  bkPaxDec: dyn('bk-pax-dec'),
  bkPaxCount: dyn('bk-pax-count'),
  bkPaxError: 'bk-pax-error',
  bkPaxAgeLabel: dyn('bk-pax-age-label'),
  bkLodgingToggle: 'bk-lodging-toggle',
  bkLodgingHotel: dyn('bk-lodging-hotel'), // :LEG-1
  bkRoomInc: dyn('bk-room-inc'),          // :LEG-1:Doble
  bkRoomsTotal: 'bk-rooms-total',
  bkNightsTotal: 'bk-nights-total',
  bkAddonInc: dyn('bk-addon-inc'),        // :ADD-1101
  bkSummaryLine: dyn('bk-line'),          // bk-line:lodge-LEG-1-Doble (data-removed=true|false)
  bkLineRemove: dyn('bk-line-remove'),
  bkLineRestore: dyn('bk-line-restore'),
  bkSubtotal: 'bk-subtotal',
  bkTotal: 'bk-total',
  bkPayMode: dyn('bk-pay-mode'),          // :total|:adelanto|:pagar_despues
  bkDeposit: 'bk-deposit',
  bkBalance: 'bk-balance',
  bkBalanceDue: 'bk-balance-due',
  bkCurrency: 'bk-currency',
  bkWarning: 'bk-warning',
  bkContinue: 'bk-continue',
  checkoutSummary: 'checkout-summary',
  checkoutPayMode: dyn('checkout-pay-mode'),
  checkoutAmountToday: 'checkout-amount-today',
  checkoutPay: 'checkout-pay',

  // ---------- Centro de reglas ----------
  ruleToggle: dyn('rule-toggle'),         // rule-toggle:R-LODGING
  ruleLocked: dyn('rule-locked'),         // candado «Disponible desde el plan X»
} as const;
