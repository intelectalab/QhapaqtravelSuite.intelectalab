import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { getToken } from "../api/client";
import { deviceId } from "../api/session";
import { uploadPending } from "../data/evidence";
import { getMe, refreshFromServer } from "../data/repository";
import { SyncEngine } from "./sync";

export const BACKGROUND_SYNC_TASK = "kipu-operator-sync";

export const DEFAULT_SYNC_MINUTES = 10;

const OS_MIN_MINUTES = 15;

export async function syncMinutes(): Promise<number> {
  const me = await getMe().catch(() => null);
  return Math.max(1, me?.sync_minutes ?? DEFAULT_SYNC_MINUTES);
}

export async function runBackgroundSync(): Promise<boolean> {
  if (!(await getToken())) return false;
  const engine = new SyncEngine({
    getToken,
    getDeviceId: deviceId,
    beforeSend: async () => {
      await uploadPending(true);
    },
    onRejected: async () => undefined,
    onConflict: () => undefined,
    onSessionExpired: () => undefined,
    refreshFromServer,
    onChange: () => undefined,
  });
  await engine.run();
  return true;
}

if (!TaskManager.isTaskDefined(BACKGROUND_SYNC_TASK)) {
  TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
    try {
      await runBackgroundSync();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

export async function registerBackgroundSync(): Promise<void> {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    const minutes = Math.max(OS_MIN_MINUTES, await syncMinutes());
    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK)) await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
    await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, { minimumInterval: minutes });
  } catch {
    return;
  }
}

export async function unregisterBackgroundSync(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK)) await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
  } catch {
    return;
  }
}
