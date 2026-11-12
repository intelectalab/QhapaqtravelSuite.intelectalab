import type { Db } from "../offline/db";
import { enqueue } from "../offline/outbox";
import type { Assignment } from "../types";
import { updateAssignment } from "./repository";

function now(): string {
  return new Date().toISOString();
}

function withFlags(assignment: Assignment): Assignment {
  const checked = assignment.passengers.some((passenger) => passenger.checked_at !== null);
  const evidence = assignment.evidences.length > 0;
  return {
    ...assignment,
    checked_in: assignment.passengers.filter((passenger) => passenger.checked_at !== null).length,
    can: {
      confirm: assignment.status === "asignada" || assignment.status === "pendiente",
      start: assignment.status === "confirmada",
      checkin: assignment.status === "en_curso",
      evidence: assignment.status === "en_curso" || assignment.status === "completada",
      finish: assignment.status === "en_curso" && checked && evidence,
    },
  };
}

export function applyConfirm(assignment: Assignment, at: string): Assignment {
  return withFlags({ ...assignment, status: "confirmada", confirmed_at: at });
}

export function applyStart(assignment: Assignment, at: string): Assignment {
  return withFlags({ ...assignment, status: "en_curso", started_at: assignment.started_at ?? at });
}

export function applyCheckin(assignment: Assignment, passengerId: string, at: string, undo: boolean): Assignment {
  const passengers = assignment.passengers.map((passenger) => (passenger.id === passengerId ? { ...passenger, checked_at: undo ? null : (passenger.checked_at ?? at) } : passenger));
  return withFlags({ ...assignment, passengers, first_checkin_at: assignment.first_checkin_at ?? (undo ? null : at) });
}

export function applyCheckinAll(assignment: Assignment, at: string): Assignment {
  const passengers = assignment.passengers.map((passenger) => ({ ...passenger, checked_at: passenger.checked_at ?? at }));
  return withFlags({ ...assignment, passengers, first_checkin_at: assignment.first_checkin_at ?? at });
}

export function applyFinish(assignment: Assignment, at: string): Assignment {
  const passengers = assignment.passengers.map((passenger) => ({ ...passenger, no_show: passenger.checked_at === null }));
  return withFlags({ ...assignment, status: "completada", finished_at: at, passengers });
}

export function applyEvidence(assignment: Assignment, evidence: { id: string; name: string; mime: string; sha256: string }): Assignment {
  return withFlags({ ...assignment, evidences: [...assignment.evidences, { ...evidence, pending: true }] });
}

function local(id: string, change: (assignment: Assignment) => Assignment) {
  return (db: Db) => updateAssignment(db, id, change);
}

export function confirm(id: string, online: boolean): Promise<string> {
  const at = now();
  return enqueue("confirm", id, {}, online, local(id, (assignment) => applyConfirm(assignment, at)));
}

export function start(id: string, online: boolean): Promise<string> {
  const at = now();
  return enqueue("start", id, {}, online, local(id, (assignment) => applyStart(assignment, at)));
}

export function checkin(id: string, passengerId: string, undo: boolean, online: boolean): Promise<string> {
  const at = now();
  return enqueue(undo ? "checkin_undo" : "checkin", id, { passenger_id: passengerId }, online, local(id, (assignment) => applyCheckin(assignment, passengerId, at, undo)));
}

export function checkinAll(id: string, online: boolean): Promise<string> {
  const at = now();
  return enqueue("checkin_all", id, {}, online, local(id, (assignment) => applyCheckinAll(assignment, at)));
}

export function finish(id: string, online: boolean): Promise<string> {
  const at = now();
  return enqueue("finish", id, {}, online, local(id, (assignment) => applyFinish(assignment, at)));
}

export function reportIncident(id: string, incident: { type: string; severity: string; title: string; description: string }, online: boolean, attach?: (db: Db, actionId: string) => Promise<void>): Promise<string> {
  return enqueue("incident", id, { ...incident, upload_ids: [] }, online, attach);
}
