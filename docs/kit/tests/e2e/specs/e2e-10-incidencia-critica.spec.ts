import { test, expect } from '../fixtures/auth';
import { action, operatorApi, pickAssignment, send } from '../support/operator';
import { R } from '../support/routes';
import { T } from '../support/testids';

/**
 * E2E-10 (esp. 05 §10; H-07): incidencia crítica desde la app → alerta a gerencia →
 * resolución con evidencia → cierre → el cierre operativo de la orden queda habilitado.
 * Fase 2 (origen app). La variante con origen web (Operaciones) es Fase 1 y usa el mismo evento.
 */
test.describe('E2E-10 · Incidencia crítica @fase2 @e2e10', () => {
  test('alerta a gerencia y cierre operativo habilitado', async ({ pageAs }) => {
    const app = await operatorApi('guide');
    const asg = await pickAssignment(app, (a) => ['en_curso', 'confirmada', 'asignada'].includes(a.status));
    test.skip(!asg, 'La semilla E2E debe incluir una asignación activa de G01');

    const r = await send(app, action('incident', asg.id, {
      type: 'Retraso', severity: 'critica', title: 'Bus averiado en Ollantaytambo', description: 'Se espera unidad de reemplazo (E2E)',
    }));
    expect(r.result).toBe('applied');
    const incCode: string = r.assignment.last_incident_code;

    // Manager ve la alerta crítica en su panel (Reverb o recarga)
    const mgr = await pageAs('manager');
    await mgr.goto(R.dashboard);
    await expect(mgr.getByTestId(T.criticalAlert)).toContainText(incCode);

    // Operaciones: resolver con evidencia y cerrar
    const ops = await pageAs('operations');
    await ops.goto(R.incident(incCode));
    await expect(ops.getByTestId(T.incidentSeverity)).toHaveAttribute('data-severity', 'critica');
    await ops.getByTestId(T.incidentEvidence).setInputFiles({ name: 'reemplazo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('e2e') });
    await ops.getByTestId(T.incidentResolve).click();
    await ops.getByTestId(T.field('resolution')).fill('Unidad de reemplazo llegó 40 min después; pasajeros informados');
    await ops.getByTestId(T.dialogConfirm).click();
    await expect(ops.getByTestId(T.statusBadge)).toHaveAttribute('data-status', 'resuelta');
    await ops.getByTestId(T.incidentClose).click();
    await ops.getByTestId(T.dialogConfirm).click();
    await expect(ops.getByTestId(T.statusBadge)).toHaveAttribute('data-status', 'cerrada');

    // Cierre operativo: la precondición «sin incidencias abiertas» pasa a OK
    await ops.goto(R.order(asg.order_code));
    await expect(ops.getByTestId(T.orderCloseChecks)).toHaveAttribute('data-incidents-ok', 'true');
  });

  test('cerrar una orden con incidencia crítica abierta → 409 (INC-0085 en OP-2026-0412)', async ({ apiAs }) => {
    const ops = await apiAs('tenantAdmin'); // tiene operations.close
    const id = await ops.idOf('/ops/orders', 'OP-2026-0412');
    const r = await ops.postIdem(`/ops/orders/${id}/close`, {});
    expect(r.status()).toBe(409);
  });
});
