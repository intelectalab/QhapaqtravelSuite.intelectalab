/* ==========================================================================
   Motor de reservas (BookingEngine) — fuente única de reglas para catálogo,
   sitio público, widget embebible, portales y back-office.
   En producción estas funciones son el servicio de dominio del backend
   (Laravel: App\Domain\Bookings\BookingEngine) expuesto por
   /api/v1/public/availability, /api/v1/public/quote y validado otra vez al confirmar.
   El navegador NUNCA es la autoridad del precio ni de la disponibilidad.
   ========================================================================== */
(function () {
  'use strict';
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
  const round2 = (n) => Math.round(n * 100) / 100;

  const BE = {
    /* ---------------- Centro de reglas (configurable por tenant y por producto) ---------------- */
    rules() { return (DB.settings && DB.settings.bookingRules) || []; },
    rule(id) { return BE.rules().find(r => r.id === id) || null; },
    /* Regla activa para el tenant y no desactivada por el producto (p.ruleOverrides[id] === false) */
    /* Plan del tenant: una regla solo funciona si el plan la incluye (entitlement) */
    planOrder() { return (DB.planCatalogDemo && DB.planCatalogDemo.order) || ['Starter', 'Professional', 'Enterprise']; },
    tenantPlan() { return (DB.subscription && DB.subscription.plan) || (DB.tenant && DB.tenant.plan) || 'Enterprise'; },
    planAllows(id, plan) { const r = BE.rule(id); if (!r || !r.minPlan) return true; const o = BE.planOrder(); return o.indexOf(plan || BE.tenantPlan()) >= o.indexOf(r.minPlan); },
    on(id, p) { const r = BE.rule(id); if (!r) return true; if (!r.enabled) return false; if (!BE.planAllows(id)) return false; if (p && r.productOverride && p.ruleOverrides && p.ruleOverrides[id] === false) return false; return true; },
    param(id, key, p) { const r = BE.rule(id) || { params: {} }; const o = p && p.ruleParams && p.ruleParams[id]; return o && o[key] != null ? o[key] : r.params[key]; },
    /* ---------------- Monedas ---------------- */
    cfg() { return (DB.settings && DB.settings.ecommerce) || {}; },
    currencies(all) { return (BE.cfg().currencies || []).filter(c => all || c.active); },
    currency(code) { return (BE.cfg().currencies || []).find(c => c.code === code) || { code, symbol: code, rate: 1 }; },
    /* rate = soles por 1 unidad de la moneda. convert(100, 'USD', 'EUR') */
    convert(amount, from, to) { if (from === to) return amount; const f = BE.currency(from).rate || 1, t = BE.currency(to).rate || 1; return amount * f / t; },
    /* Conversión para MOSTRAR precios: aplica el margen de conversión solo si la moneda de destino no es de cobro */
    display(amount, from, to) { const v = BE.convert(amount, from, to); const charge = BE.cfg().chargeCurrencies || []; const m = BE.on('R-MULTICURRENCY') ? (BE.param('R-MULTICURRENCY', 'fxMarginPct') || 0) : 0; return charge.includes(to) ? v : v * (1 + m / 100); },
    fmt(amount, code) { const c = BE.currency(code); const dec = ['CLP', 'COP', 'JPY', 'ARS'].includes(code) ? 0 : 2; return c.symbol + ' ' + Number(amount || 0).toLocaleString('es-PE', { minimumFractionDigits: dec, maximumFractionDigits: dec }); },

    /* ---------------- Reglas de pasajeros ---------------- */
    paxRules(p) {
      const d = BE.cfg().defaultPaxRules || {}; const r = Object.assign({ infantAllowed: true }, d, p.paxRules || {});
      if (!BE.on('R-CHILD-PER-ADULT', p)) { r.maxChildrenPerAdult = 99; r.childPricePct = 100; r.childBands = false; }
      if (!BE.on('R-INFANT-FREE', p)) { r.maxInfantsPerAdult = 99; r.infantPays = true; }
      if (!BE.on('R-MIN-ADULTS', p)) r.minAdults = 0;
      return r;
    },
    /* Clasifica una edad según las reglas del producto */
    ageType(p, age) { const r = BE.paxRules(p); if (age == null || age === '') return 'ADT'; age = Number(age); if (age >= r.adultMinAge) return 'ADT'; if (age >= r.childMinAge && age <= r.childMaxAge) return 'CHD'; if (age <= r.infantMaxAge) return 'INF'; return 'NA'; },
    /* Valida la composición del grupo. pax = {adt, chd, inf} */
    validatePax(p, pax) {
      const r = BE.paxRules(p); const e = [];
      const adt = +pax.adt || 0, chd = +pax.chd || 0, inf = +pax.inf || 0;
      if (r.minAdults && adt < r.minAdults) e.push('Se requiere al menos ' + (r.minAdults || 1) + ' adulto(s) (' + r.adultMinAge + '+ años).');
      if (chd > adt * r.maxChildrenPerAdult) e.push('Máximo ' + r.maxChildrenPerAdult + ' niño(s) de ' + r.childMinAge + ' a ' + r.childMaxAge + ' años por cada adulto.');
      if (inf > 0 && r.infantAllowed === false) e.push('Este servicio no admite infantes (menores de ' + (r.childMinAge) + ' años).');
      else if (inf > adt * r.maxInfantsPerAdult) e.push('Máximo ' + r.maxInfantsPerAdult + ' infante(s) de 0 a ' + r.infantMaxAge + ' años por cada adulto.');
      const seats = adt + chd + (r.infantPays ? inf : 0);
      if (BE.on('R-MAX-PAX', p) && p.maxPax && seats > p.maxPax) e.push('Máximo ' + p.maxPax + ' pasajeros por reserva.');
      return { ok: !e.length, errors: e, seats };
    },

    /* ---------------- Disponibilidad por rangos ----------------
       Estados de un día: disponible | cerrado | agotado | sin_cupo | fuera_de_plazo | no_opera | sin_configurar */
    dayStatus(p, dateStr, seatsWanted) {
      const av = BE.on('R-AVAIL-RANGES', p) ? p.availability : null; const today = window.TODAY;
      if (dateStr < today) return { status: 'pasado', label: 'Fecha pasada', left: 0 };
      const dep = (p.departures || []).find(d => d.date === dateStr);
      /* Anticipación y días de operación se evalúan aunque los rangos estén desactivados */
      const cutoffH = BE.on('R-CUTOFF', p) ? ((p.availability && p.availability.cutoffHours) || (p.advMin || 0) * 24 || BE.param('R-CUTOFF', 'defaultHours')) : 0;
      if (cutoffH && diffDays(today, dateStr) * 24 < cutoffH) return { status: 'fuera_de_plazo', label: 'Reserva con ' + Math.ceil(cutoffH / 24) + ' día(s) de anticipación', left: 0 };
      const wd = p.availability && p.availability.weekdays;
      if (wd && BE.on('R-WEEKDAYS', p) && !wd.includes(parse(dateStr).getDay())) return { status: 'no_opera', label: 'No opera este día', left: 0 };
      if (!av && !dep) return p.availability && !BE.on('R-AVAIL-RANGES', p) ? { status: 'disponible', label: 'Disponible', left: null } : { status: 'sin_configurar', label: 'Consultar', left: null };
      let range = null;
      if (av && av.ranges) { const hits = av.ranges.filter(r => dateStr >= r.from && dateStr <= r.to); range = hits.find(r => r.status !== 'disponible') || hits[0] || null; }
      if (range && range.status === 'cerrado') return { status: 'cerrado', label: 'Ocupado / cerrado', note: range.note, left: 0, range };
      if (range && range.status === 'agotado') return { status: 'agotado', label: 'Agotado', note: range.note, left: 0, range };
      let cap = dep ? dep.capacity : range ? range.capacityPerDay : null;
      if (cap == null) return { status: av && av.ranges && av.ranges.length ? 'cerrado' : 'sin_configurar', label: av && av.ranges && av.ranges.length ? 'Sin salida programada' : 'Consultar', left: 0 };
      const sold = dep ? dep.sold : BE.soldOn(p, dateStr);
      const held = BE.heldOn(p, dateStr);
      const left = Math.max(0, cap - sold - held);
      if (left <= 0) return { status: 'agotado', label: 'Agotado', left: 0, range };
      if (seatsWanted && left < seatsWanted) return { status: 'sin_cupo', label: 'Quedan ' + left + ' cupo(s)', left, range };
      return { status: 'disponible', label: left <= 4 ? 'Últimos ' + left + ' cupos' : 'Disponible', left, cap, range, departure: dep || null };
    },
    soldOn(p, dateStr) { let n = 0; (DB.reservations || []).forEach(r => { if (['cancelada', 'borrador'].includes(r.status)) return; (r.services || []).forEach(s => { if (s.productId === p.id && s.date === dateStr && s.status !== 'cancelado') n += (s.pax || r.passengers.filter(x => x.type !== 'INF').length || 1); }); }); return n; },
    heldOn(p, dateStr) { const now = Date.now(); return (DB.catalogHolds || []).filter(h => h.productId === p.id && h.date === dateStr && h.status === 'hold' && (!h.expiresAt || new Date(h.expiresAt.replace(' ', 'T')).getTime() > now)).reduce((a, h) => a + (h.qty || 0), 0); },
    /* Calendario de un mes: [{date, day, status, label, left}] */
    month(p, year, month0, seats) { const out = []; const d = new Date(year, month0, 1); while (d.getMonth() === month0) { const s = ymd(d); out.push(Object.assign({ date: s, day: d.getDate(), weekday: d.getDay() }, BE.dayStatus(p, s, seats))); d.setDate(d.getDate() + 1); } return out; },
    /* Resumen de rangos para mostrar texto tipo «Disponible del 02 al 06 oct; ocupado del 07 al 09 oct» */
    rangesSummary(p) { return ((p.availability && p.availability.ranges) || []).slice().sort((a, b) => a.from.localeCompare(b.from)); },
    nextAvailable(p, seats, from) { let d = from || window.TODAY; for (let i = 0; i < 400; i++) { const st = BE.dayStatus(p, d, seats); if (st.status === 'disponible') return d; d = addDays(d, 1); } return null; },
    /* Valida que un rango nuevo no se solape con otro del mismo producto */
    overlaps(p, from, to, exceptId) { return ((p.availability && p.availability.ranges) || []).filter(r => r.id !== exceptId && !(to < r.from || from > r.to)); },

    /* ---------------- Precio ----------------
       sel = { date, pax:{adt,chd,inf}, addons:[{id, qty}], lodging:[{legId, hotelId, rooms:[{type, qty}]}], options:[{group, label}], currency, paymentMode, removed:[lineKey],
             nights:{legId:n}, tours:[{id}], transport:[{id}] (v2.8 · R-TRIP-BUILDER) } */
    baseRate(p, segment, channel) {
      const ok = (r) => r.status === 'vigente' && (!channel || r.channel === channel || r.channel === 'Directo');
      return (p.rates || []).find(r => ok(r) && r.segment === segment) || null;
    },
    quote(p, sel) {
      const r = BE.paxRules(p); const pax = sel.pax || { adt: 1, chd: 0, inf: 0 };
      const cur = sel.currency || BE.cfg().baseCurrency || 'PEN';
      const lines = []; const warnings = [];
      const v = BE.validatePax(p, pax); v.errors.forEach(x => warnings.push(x));
      const season = sel.date && window.Pricing && BE.on('R-SEASON', p) ? Pricing.seasonFor(sel.date) : null;
      const factor = season ? season.factor : 1;
      const adtRate = BE.baseRate(p, 'Adulto', sel.channel) || BE.baseRate(p, 'Pasajero', sel.channel);
      if (!adtRate) warnings.push('El producto no tiene tarifa vigente (PRD-BR-005).');
      const rc = adtRate ? adtRate.currency : 'PEN';
      const chdRate = BE.baseRate(p, 'Niño', sel.channel);
      const optDelta = (sel.options || []).reduce((a, o) => { const g = (p.config || []).find(x => x.group === o.group); const op = g && g.options.find(x => x.label === o.label); return a + (op ? op.delta : 0); }, 0);
      const adtUnit = adtRate ? (adtRate.price + optDelta) * factor : 0;
      const chdUnit = r.childPays ? (chdRate ? chdRate.price * factor : adtUnit * (r.childPricePct || 100) / 100) : 0;
      const infUnit = r.infantPays ? chdUnit : 0;
      const canRemove = BE.on('R-PREVIEW-REMOVE', p);
      const add = (key, kind, label, qty, unit, currency, removable, meta) => { removable = removable && canRemove; const amount = BE.display(unit * qty, currency, cur); lines.push(Object.assign({ key, kind, label, qty, unit: BE.display(unit, currency, cur), amount, removable, removed: removable && (sel.removed || []).includes(key) }, meta || {})); };
      if (pax.adt) add('base-adt', 'base', 'Tour · adulto (' + r.adultMinAge + '+ años)', pax.adt, adtUnit, rc, false);
      if (pax.chd) add('base-chd', 'base', 'Tour · niño (' + r.childMinAge + '–' + r.childMaxAge + ' años)' + (r.childPays ? '' : ' · sin costo'), pax.chd, chdUnit, rc, false);
      if (pax.inf) add('base-inf', 'base', 'Infante (0–' + r.infantMaxAge + ' años)' + (r.infantPays ? '' : ' · no paga'), pax.inf, infUnit, rc, false);
      if (season && factor !== 1) lines.push({ key: 'season', kind: 'info', label: 'Tarifa de ' + season.name + ' (factor ' + factor + ')', qty: 0, unit: 0, amount: 0, removable: false });
      /* Adicionales */
      (BE.on('R-ADDONS', p) ? (sel.addons || []) : []).forEach(a => { const ad = (p.addons || []).find(x => x.id === a.id); if (!ad || !a.qty) return; add('addon-' + ad.id, 'addon', ad.name, a.qty, ad.price, ad.currency, true, { addonId: ad.id, category: ad.category }); });
      /* Alojamiento por ciudad */
      let rooms = 0, nights = 0, beds = 0;
      const legs = (p.accommodation && p.accommodation.legs) || [];
      /* v2.8 · Viaje por tramos (R-TRIP-BUILDER): noches por ciudad dentro de [minNights, maxNights] y fechas reales de cada tramo */
      const tripOn = BE.on('R-TRIP-BUILDER', p);
      const nightsOf = (leg) => { if (!tripOn) return leg.nights; const v = sel.nights && sel.nights[leg.id]; if (v == null) return leg.nights; return Math.max(leg.minNights || leg.nights, Math.min(leg.maxNights || leg.nights, +v)); };
      const sched = BE.tripSchedule(p, sel);
      const nightPrice = (h, base, d) => { if (!tripOn) return base; const hit = (h.seasonRates || []).find(r => d >= r.from && d <= r.to); return hit ? round2(base * (1 + hit.pct / 100)) : base; };
      (BE.on('R-LODGING', p) ? (sel.lodging || []) : []).forEach(l => {
        const leg = legs.find(x => x.id === l.legId); if (!leg) return; const h = leg.hotels.find(x => x.id === l.hotelId); if (!h) return;
        let legRooms = 0, legBeds = 0;
        const ln = nightsOf(leg); const sc = sched.find(x => x.legId === leg.id) || {};
        (l.rooms || []).forEach(rm => { const t = h.rooms.find(x => x.type === rm.type); if (!t || !rm.qty) return; legRooms += rm.qty; legBeds += rm.qty * t.capacity;
          /* Tarifa por noche según la fecha real de cada noche del tramo (temporadas del hotel) */
          let sumN = 0; const hits = new Set(); for (let i = 0; i < ln; i++) { const d = sc.checkIn ? addDays(sc.checkIn, i) : null; const pr = d ? nightPrice(h, t.price, d) : t.price; sumN += pr; if (pr !== t.price) { const r = (h.seasonRates || []).find(z => d >= z.from && d <= z.to); if (r) hits.add(r.label + ' +' + r.pct + ' %'); } }
          const avg = ln ? round2(sumN / ln) : t.price;
          add('lodge-' + leg.id + '-' + rm.type, 'lodging', leg.city + ' · ' + h.name + ' · ' + rm.qty + ' hab. ' + rm.type.toLowerCase() + ' × ' + ln + ' noche(s)' + (hits.size ? ' · ' + [...hits].join(', ') : ''), rm.qty * ln, avg, p.accommodation.currency || 'USD', true, { legId: leg.id, city: leg.city, hotel: h.name, roomType: rm.type, rooms: rm.qty, nights: ln, checkIn: sc.checkIn || null, checkOut: sc.checkOut || null, seasonal: hits.size > 0 }); });
        const need = (+pax.adt || 0) + (+pax.chd || 0);
        if (BE.on('R-LODGING-CAPACITY', p) && legRooms && legBeds < need) warnings.push(leg.city + ': las habitaciones elegidas alojan ' + legBeds + ' persona(s) y el grupo necesita ' + need + ' camas (los infantes comparten).');
        if (!(sel.removed || []).some(k => k.startsWith('lodge-' + leg.id))) { rooms += legRooms; nights += legRooms ? ln : 0; }
        beds += legBeds;
      });
      /* Suplemento simple */
      if (BE.on('R-SINGLE-SUPP', p)) lines.filter(l => l.kind === 'lodging' && l.roomType === 'Simple' && !l.removed).forEach(l => { const pct = BE.param('R-SINGLE-SUPP', 'pct', p); lines.push({ key: 'supp-' + l.key, kind: 'surcharge', label: 'Suplemento habitación simple ' + l.city + ' (' + pct + ' %)', qty: 1, unit: round2(l.amount * pct / 100), amount: round2(l.amount * pct / 100), removable: false, removed: false }); });
      /* v2.8 · Tours por ciudad y movilidad (R-TRIP-BUILDER). Infantes no pagan; el tour respeta la edad mínima con advertencia. */
      const trip = p.trip || {}; const tc = trip.currency || rc;
      if (tripOn) {
        (sel.tours || []).forEach(o => { const t = (trip.tours || []).find(x => x.id === (o.id || o)); if (!t) return; const sc = sched.find(x => x.legId === t.legId) || {};
          const a = +pax.adt || 0, c = t.priceChd > 0 || !t.minAge ? (+pax.chd || 0) : 0; const amt = a * t.priceAdt + c * (t.priceChd || 0);
          if (t.minAge && (+pax.chd || 0)) warnings.push(t.name + ': edad mínima ' + t.minAge + ' años; los niños menores no participan.');
          const d = sc.checkIn ? addDays(sc.checkIn, Math.min(t.dayOffset || 0, Math.max(0, (sc.nights || 1) - 1))) : null;
          add('tour-' + t.id, 'tour', (sc.city ? sc.city + ' · ' : '') + t.name + (d ? ' · ' + d.slice(8) + '/' + d.slice(5, 7) + ' ' + t.time : ''), 1, amt, tc, true, { tourId: t.id, legId: t.legId, date: d, time: t.time, adt: a, chd: c }); });
        const people = (+pax.adt || 0) + (+pax.chd || 0);
        (sel.transport || []).forEach(o => { const t = (trip.transport || []).find(x => x.id === (o.id || o)); if (!t) return; let amt = 0, unitLbl = '';
          if (t.pricing === 'vehiculo') { const vs = (t.vehicles || []).slice().sort((a, b) => a.maxPax - b.maxPax); let v = vs.find(x => x.maxPax >= people); let units = 1; if (!v) { v = vs[vs.length - 1]; units = Math.ceil(people / v.maxPax); } amt = v.price * units; unitLbl = ' · ' + (units > 1 ? units + ' × ' : '') + v.name; }
          else amt = (+pax.adt || 0) * t.priceAdt + (+pax.chd || 0) * (t.priceChd || t.priceAdt);
          const from = sched.find(x => x.legId === t.fromLegId) || {}; const to = t.toLegId ? sched.find(x => x.legId === t.toLegId) || {} : null;
          const d = to ? to.checkIn : from.checkIn;
          add('trans-' + t.id, 'transport', t.name + unitLbl + (d ? ' · ' + d.slice(8) + '/' + d.slice(5, 7) : ''), 1, amt, tc, true, { transportId: t.id, mode: t.kind, date: d, pricing: t.pricing }); });
      }
      const active = lines.filter(l => !l.removed);
      const subtotal = round2(active.reduce((a, l) => a + l.amount, 0));
      const adjustments = [];
      const payers = (+pax.adt || 0) + (r.childPays ? (+pax.chd || 0) : 0);
      if (BE.on('R-GROUP-DISC', p) && payers >= BE.param('R-GROUP-DISC', 'fromPax', p)) adjustments.push({ key: 'group', label: 'Descuento de grupo (' + BE.param('R-GROUP-DISC', 'pct', p) + ' %)', amount: -round2(subtotal * BE.param('R-GROUP-DISC', 'pct', p) / 100) });
      if (sel.date && BE.on('R-EARLY-BIRD', p) && diffDays(window.TODAY, sel.date) >= BE.param('R-EARLY-BIRD', 'days', p)) adjustments.push({ key: 'early', label: 'Reserva anticipada (' + BE.param('R-EARLY-BIRD', 'pct', p) + ' %)', amount: -round2(subtotal * BE.param('R-EARLY-BIRD', 'pct', p) / 100) });
      if (sel.date && BE.on('R-LAST-MINUTE', p) && diffDays(window.TODAY, sel.date) < BE.param('R-LAST-MINUTE', 'days', p)) adjustments.push({ key: 'last', label: 'Recargo de última hora (' + BE.param('R-LAST-MINUTE', 'pct', p) + ' %)', amount: round2(subtotal * BE.param('R-LAST-MINUTE', 'pct', p) / 100) });
      const promo = sel.promoPct && BE.on('R-PROMO', p) ? round2(subtotal * sel.promoPct / 100) : 0;
      if (promo) adjustments.push({ key: 'promo', label: 'Código promocional (' + sel.promoPct + ' %)', amount: -promo });
      let total = round2(subtotal + adjustments.reduce((a, x) => a + x.amount, 0));
      if (BE.on('R-PAY-FEE', p) && sel.paymentMethod === 'tarjeta') { const fee = round2(total * BE.param('R-PAY-FEE', 'cardPct', p) / 100); adjustments.push({ key: 'fee', label: 'Recargo por pago con tarjeta (' + BE.param('R-PAY-FEE', 'cardPct', p) + ' %)', amount: fee }); total = round2(total + fee); }
      const pay = p.payment || {}; let modes = (pay.modes || BE.cfg().paymentModes || ['total']).slice();
      if (!BE.on('R-DEPOSIT', p)) modes = modes.filter(m => m !== 'adelanto');
      if (BE.on('R-PAY-LATER', p) && !modes.includes('pagar_despues')) modes.push('pagar_despues');
      if (!modes.length) modes = ['total'];
      const mode = modes.includes(sel.paymentMode) ? sel.paymentMode : modes[0];
      const pct = mode === 'adelanto' ? (pay.depositPct != null ? pay.depositPct : BE.param('R-DEPOSIT', 'pct') || BE.cfg().depositPctDefault || 30) : mode === 'pagar_despues' ? 0 : 100;
      const deposit = round2(total * pct / 100);
      const dueDays = pay.balanceDueDays != null ? pay.balanceDueDays : BE.param('R-DEPOSIT', 'balanceDueDays') || BE.cfg().balanceDueDaysDefault || 15;
      let balanceDue = sel.date && mode !== 'total' ? addDays(sel.date, -dueDays) : null;
      if (balanceDue && balanceDue < window.TODAY) { balanceDue = window.TODAY; warnings.push('La salida es cercana: el saldo se cobra de inmediato.'); }
      return { currency: cur, lines, adjustments, holdHours: mode === 'pagar_despues' ? BE.param('R-PAY-LATER', 'holdHours', p) : null, subtotal, promo, total, paymentMode: mode, modes, depositPct: pct, deposit, balance: round2(total - deposit), balanceDue, rooms, nights, beds, warnings, legs: sched, tripEnd: sched.length ? sched[sched.length - 1].checkOut : null, byCategory: BE.byCategory(lines),  ok: !warnings.some(w => /Se requiere|Máximo|no admite|sin tarifa|no tiene tarifa/i.test(w)), season, rateCurrency: rc, note: 'Precio calculado por el servidor al confirmar; tipo de cambio referencial.' };
    },
    /* v2.8 · Calendario del viaje por tramos: fecha de llegada y salida de cada ciudad según las noches elegidas */
    tripSchedule(p, sel) {
      const legs = (p.accommodation && p.accommodation.legs) || []; if (!legs.length) return [];
      const on = BE.on('R-TRIP-BUILDER', p); let d = sel && sel.date ? sel.date : null;
      return legs.map(leg => { let n = leg.nights; if (on && sel && sel.nights && sel.nights[leg.id] != null) n = Math.max(leg.minNights || leg.nights, Math.min(leg.maxNights || leg.nights, +sel.nights[leg.id]));
        const o = { legId: leg.id, city: leg.city, nights: n, minNights: leg.minNights || leg.nights, maxNights: leg.maxNights || leg.nights, checkIn: d, checkOut: d ? addDays(d, n) : null }; if (d) d = addDays(d, n); return o; });
    },
    /* Total por categoría (base del tour, alojamiento, tours, movilidad, adicionales, recargos) sin líneas quitadas */
    byCategory(lines) {
      const m = { base: 0, lodging: 0, tour: 0, transport: 0, addon: 0, surcharge: 0 };
      lines.filter(l => !l.removed && m[l.kind] != null).forEach(l => { m[l.kind] = round2(m[l.kind] + l.amount); });
      return m;
    },
    /* Totales de alojamiento de un itinerario multi-ciudad */
    lodgingTotals(p, lodging) { const q = BE.quote(p, { pax: { adt: 1 }, lodging }); return { rooms: q.rooms, nights: q.nights }; },
    util: { ymd, parse, addDays, diffDays }
  };
  window.BookingEngine = BE;
})();
