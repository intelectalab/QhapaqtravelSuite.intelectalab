import { CryptoDigestAlgorithm, digest } from "expo-crypto";
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { api } from "../api/client";
import { getDb, type Db } from "../offline/db";
import { enqueue, uuidv7 } from "../offline/outbox";
import { applyEvidence } from "./actions";
import { updateAssignment } from "./repository";

const MAX_SIDE = 1920;
const QUALITY = 0.7;
const MIME = "image/jpeg";
export const MAX_UPLOAD_ATTEMPTS = 5;

export interface FailedPhoto {
  id: string;
  assignment_id: string;
  file_name: string;
  attempts: number;
  last_error: string | null;
}

export function nextUploadState(attempts: number): "pending" | "failed" {
  return attempts >= MAX_UPLOAD_ATTEMPTS ? "failed" : "pending";
}

export interface Photo {
  id: string;
  uri: string;
  name: string;
  size: number;
  sha256: string;
}

interface PendingEvidence {
  id: string;
  assignment_id: string;
  local_uri: string;
  file_name: string;
  mime: string;
  size: number;
  sha256: string;
  incident_action_id: string | null;
  attempts: number;
}

interface Presigned {
  upload_id: string;
  url: string;
  headers: Record<string, string>;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function capturePhoto(): Promise<Photo | "cancelled" | "denied"> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return "denied";

  const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 });
  if (shot.canceled || !shot.assets[0]) return "cancelled";

  const asset = shot.assets[0];
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > MAX_SIDE) context.resize(asset.width >= asset.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG });

  const bytes = await new File(saved.uri).arrayBuffer();
  return {
    id: uuidv7(),
    uri: saved.uri,
    name: `evidencia-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.jpg`,
    size: bytes.byteLength,
    sha256: toHex(await digest(CryptoDigestAlgorithm.SHA256, bytes)),
  };
}

async function storePhoto(db: Db, assignmentId: string, photo: Photo, incidentActionId: string | null): Promise<void> {
  await db.runAsync("INSERT INTO evidences (id, assignment_id, local_uri, file_name, mime, size, sha256, incident_action_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
    photo.id,
    assignmentId,
    photo.uri,
    photo.name,
    MIME,
    photo.size,
    photo.sha256,
    incidentActionId,
  ]);
}

export async function takePhoto(assignmentId: string): Promise<"saved" | "cancelled" | "denied"> {
  const photo = await capturePhoto();
  if (photo === "cancelled" || photo === "denied") return photo;

  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await storePhoto(db, assignmentId, photo, null);
    await updateAssignment(db, assignmentId, (assignment) => applyEvidence(assignment, { id: photo.id, name: photo.name, mime: MIME, sha256: photo.sha256 }));
  });
  return "saved";
}

export async function attachToIncident(db: Db, assignmentId: string, incidentActionId: string, photos: Photo[]): Promise<void> {
  for (const photo of photos) await storePhoto(db, assignmentId, photo, incidentActionId);
}

export function withUpload(payloadJson: string, uploadId: string): string {
  const payload = JSON.parse(payloadJson) as { upload_ids?: string[] } & Record<string, unknown>;
  const uploads = Array.isArray(payload.upload_ids) ? payload.upload_ids : [];
  return JSON.stringify({ ...payload, upload_ids: uploads.includes(uploadId) ? uploads : [...uploads, uploadId] });
}

async function linkUpload(db: Db, evidence: PendingEvidence, uploadId: string): Promise<void> {
  if (evidence.incident_action_id) {
    const row = await db.getFirstAsync<{ payload_json: string }>("SELECT payload_json FROM outbox WHERE client_action_id = ?", [evidence.incident_action_id]);
    if (row) await db.runAsync("UPDATE outbox SET payload_json = ? WHERE client_action_id = ?", [withUpload(row.payload_json, uploadId), evidence.incident_action_id]);
    return;
  }
  await enqueue("evidence", evidence.assignment_id, { upload_id: uploadId, sha256: evidence.sha256 }, true);
}

export async function uploadPending(online: boolean): Promise<number> {
  if (!online) return 0;
  const db = await getDb();
  const pending = await db.getAllAsync<PendingEvidence>("SELECT * FROM evidences WHERE state = 'pending' ORDER BY created_at");
  let uploaded = 0;

  for (const evidence of pending) {
    try {
      const signed = await api<Presigned>("/ops/evidences/presign", { method: "POST", body: { file_name: evidence.file_name, mime: evidence.mime, size: evidence.size, sha256: evidence.sha256 } });
      const result = await new File(evidence.local_uri).upload(signed.url, { httpMethod: "PUT", headers: { "Content-Type": evidence.mime, ...signed.headers } });
      if (result.status < 200 || result.status >= 300) throw new Error(`El almacenamiento respondió ${result.status}`);

      await db.withTransactionAsync(async () => {
        await db.runAsync("UPDATE evidences SET state = 'uploaded', upload_id = ?, last_error = NULL WHERE id = ?", [signed.upload_id, evidence.id]);
        await linkUpload(db, evidence, signed.upload_id);
      });
      uploaded++;
    } catch (error) {
      const attempts = evidence.attempts + 1;
      await db.runAsync("UPDATE evidences SET attempts = ?, state = ?, last_error = ? WHERE id = ?", [attempts, nextUploadState(attempts), error instanceof Error ? error.message : "No se pudo subir la foto", evidence.id]);
    }
  }
  return uploaded;
}

export async function failedPhotos(): Promise<FailedPhoto[]> {
  const db = await getDb();
  return db.getAllAsync<FailedPhoto>("SELECT id, assignment_id, file_name, attempts, last_error FROM evidences WHERE state = 'failed' ORDER BY created_at");
}

export async function retryPhoto(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE evidences SET state = 'pending', attempts = 0, last_error = NULL WHERE id = ? AND state = 'failed'", [id]);
}

export async function pendingCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM evidences WHERE state = 'pending'");
  return row?.n ?? 0;
}
