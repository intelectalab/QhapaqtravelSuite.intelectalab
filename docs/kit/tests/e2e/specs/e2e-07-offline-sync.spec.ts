import { test, expect } from '../fixtures/auth';
import { action, operatorApi, pickAssignment, sync } from '../support/operator';
import { idemKey } from '../support/api';
import { TODAY } from '../support/expected';
import { R } from '../support/routes';
import { T } from '../support/testids';

/**
 * E2E-07 (esp. 05 §4.8, MOB-BR-01…11): app del operador offline con 3 acciones en outbox →
 * reconectar → Synced; el conflicto (confirmación ya registrada en web) se resuelve por regla y se informa.
 * Fase 2. La coalescencia local (MOB-BR-03) y los estados pending/syncing viven en la app (prueba Maestro).
 */
test.describe('E2E-07 · Sincronización offline @fase2 @e2e07', () => {
  test('lote de 3 acciones con 1 conflicto resuelto', async ({ apiAs, pageAs }) => {
    const app = await operatorApi('guide');
    const asg = await pickAssignment(app, (a) => a.service_date === TODAY && a.status === 'asignada');
    test.skip(!asg, 'La semilla E2E debe incluir una asignación de G01 en estado asignada para hoy');

    // Mientras el guía está offline, Operaciones registra la confirmación del recurso en web
    const ops = await apiAs('operations');
    const web = await ops.postIdem(`/ops/assignments/${asg.id}/confirm`, {}, idemKey(), asg.lock_version);
    expect(web.status()).toBeLessThan(300);

    const t0 = new Date(Date.now() - 20 * 60_000);
    const outbox = [
      action('confirm', asg.id, {}, true, t0),                                        // duplicado de lo hecho en web
      action('start', asg.id, {}, true, new Date(t0.getTime() + 5 * 60_000)),
      action('checkin', asg.id, { passenger_id: asg.passengers[0].id }, true, new Date(t0.getTime() + 10 * 60_000)),
    ];

    const res = await sync(app, outbox);
    const byId = Object.fromEntries(res.results.map((r) => [r.client_action_id, r]));
    expect(byId[outbox[0].client_action_id].result).toBe('conflict');
    expect(byId[outbox[0].client_action_id].conflict_rule).toBe('MOB-BR-05');   // se descarta sin error
    expect(byId[outbox[1].client_action_id].result).toBe('applied');
    expect(byId[outbox[2].client_action_id].result).toBe('applied');

    // Reenviar el mismo lote (reconexión inestable) es idempotente
    const replay = await sync(app, outbox);
    expect(replay.results.every((r) => ['applied', 'conflict'].includes(r.result))).toBeTruthy();

    // La hora real de inicio del dispositivo se conserva (MOB-BR-07) y se ve en la orden 360
    const page = await pageAs('operations');
    await page.goto(R.order(asg.order_code));
    await expect(page.getByTestId(T.orderStepState(`${asg.id}:inicio`))).toHaveAttribute('data-at', outbox[1].occurred_at.slice(0, 16));
  });

  test('acción inválida → rejected con motivo (MOB-BR-10)', async () => {
    const app = await operatorApi('guide');
    const asg = await pickAssignment(app, (a) => a.status === 'completada');
    test.skip(!asg, 'Sin asignación completada del guía en la ventana de bootstrap');
    const res = await sync(app, [action('start', asg.id, {}, true)]);
    expect(res.results[0].result).toBe('rejected');
    expect(res.results[0].message).toBeTruthy();
  });
});
