import { api } from "../api/client";
import { getDb, getState, setState, type Db } from "../offline/db";
import type { Assignment, Bootstrap, Incident, OperatorMe } from "../types";

function sortKey(assignment: Assignment): string {
  return `${assignment.date} ${assignment.time ?? "99:99"}`;
}

export async function listAssignments(): Promise<Assignment[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ json: string }>("SELECT json FROM assignments");
  return rows.map((row) => JSON.parse(row.json) as Assignment).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
}

export async function getAssignment(id: string): Promise<Assignment | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ json: string }>("SELECT json FROM assignments WHERE id = ?", [id]);
  return row ? (JSON.parse(row.json) as Assignment) : null;
}

export async function saveAssignment(db: Db, assignment: Assignment): Promise<void> {
  await db.runAsync("INSERT INTO assignments (id, service_date, json) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET service_date = excluded.service_date, json = excluded.json", [
    assignment.id,
    assignment.date,
    JSON.stringify(assignment),
  ]);
}

export async function updateAssignment(db: Db, id: string, change: (assignment: Assignment) => Assignment): Promise<void> {
  const row = await db.getFirstAsync<{ json: string }>("SELECT json FROM assignments WHERE id = ?", [id]);
  if (!row) return;
  await saveAssignment(db, change(JSON.parse(row.json) as Assignment));
}

export async function getMe(): Promise<OperatorMe | null> {
  const value = await getState("me");
  return value ? (JSON.parse(value) as OperatorMe) : null;
}

export async function getIncidents(): Promise<Incident[]> {
  const value = await getState("incidents");
  return value ? (JSON.parse(value) as Incident[]) : [];
}

export async function lastSyncAt(): Promise<string | null> {
  return getState("last_sync_at");
}

export async function refreshFromServer(): Promise<void> {
  const db = await getDb();
  const known = (await db.getAllAsync<{ id: string }>("SELECT id FROM assignments")).map((row) => row.id);
  const since = await getState("cursor");
  const device = await getState("device_id");
  const data = await api<Bootstrap>("/mobile/operator/bootstrap", { query: { since: since ?? undefined, known }, headers: device ? { "X-Device-Id": device } : undefined });

  await db.withTransactionAsync(async () => {
    for (const assignment of data.assignments) await saveAssignment(db, assignment);
    for (const id of data.tombstones) await db.runAsync("DELETE FROM assignments WHERE id = ?", [id]);
    await db.runAsync("DELETE FROM assignments WHERE service_date < ? OR service_date > ?", [data.window.from, data.window.to]);
  });
  await setState("cursor", data.cursor);
  await setState("me", JSON.stringify(data.me));
  await setState("incidents", JSON.stringify(data.incidents));
  await setState("last_sync_at", new Date().toISOString());
}

export async function reloadAssignment(id: string): Promise<void> {
  const db = await getDb();
  const fresh = await api<Assignment>(`/mobile/operator/assignments/${id}`);
  await saveAssignment(db, fresh);
}
