import { test, expect } from '../fixtures/auth';
import { action, operatorApi, pickAssignment, send } from '../support/operator';
import { TODAY } from '../support/expected';
import { R } from '../support/routes';
import { T } from '../support/testids';

/**
 * E2E-04 (esp. 05 §10): asignación → app operador: confirmar → iniciar → check-in → evidencia →
 * finalizar → la orden 360 del back-office muestra el servicio completado.
 * La app es React Native (Expo): aquí se ejerce su contrato de API y se verifica el efecto en Next.js.
 * Fase 2 (apps móviles). Requiere en la semilla E2E una asignación de G01 (U09) para hoy.
 */
test.describe('E2E-04 · Ejecución en campo @fase2 @e2e04', () => {
  test('pasos de campo y reflejo en la orden 360', async ({ pageAs }) => {
    const app = await operatorApi('guide');
    const asg = await pickAssignment(app, (a) => a.service_date === TODAY && ['asignada', 'confirmada'].includes(a.status));
    test.skip(!asg, 'La semilla E2E debe incluir una asignación de G01 con fecha = E2E_FROZEN_TODAY');

    const steps = [
      action('confirm', asg.id),
      action('start', asg.id),
      action('checkin_all', asg.id, { passenger_ids: asg.passengers.map((p: any) => p.id) }),
      action('evidence', asg.id, { kind: 'foto', sha256: 'e2e'.padEnd(64, '0'), file_name: 'grupo.jpg' }),
      action('finish', asg.id, { note: 'Servicio sin novedades' }),
    ];
    for (const s of steps) {
      const r = await send(app, s);
      expect(r.result, `${s.type}: ${r.message ?? ''}`).toBe('applied');
    }

    // Reenviar la misma acción (mismo client_action_id) no duplica efectos (MOB-BR-01)
    const again = await send(app, steps[2]);
    expect(['applied', 'conflict']).toContain(again.result);

    const ops = await pageAs('operations');
    await ops.goto(R.order(asg.order_code));
    for (const step of ['confirmado', 'inicio', 'checkin', 'evidencia', 'fin']) {
      await expect(ops.getByTestId(T.orderStepState(`${asg.id}:${step}`))).toHaveAttribute('data-state', 'done');
    }
    await expect(ops.getByTestId(T.tableRow(asg.id)).getByTestId(T.statusBadge)).toHaveAttribute('data-status', 'completada');
  });

  test('usuario externo sin recurso vinculado → 403 (MOB-BR-13)', async ({ apiAs }) => {
    const b2b = await apiAs('b2b');
    const r = await b2b.get('/mobile/operator/bootstrap');
    expect(r.status()).toBe(403);
  });
});
