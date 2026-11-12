import NetInfo from "@react-native-community/netinfo";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { getToken } from "../api/client";
import { deviceId, logout, sessionKind, type SessionKind } from "../api/session";
import { uploadPending } from "../data/evidence";
import { refreshFromServer, reloadAssignment } from "../data/repository";
import { DEFAULT_SYNC_MINUTES, registerBackgroundSync, syncMinutes, unregisterBackgroundSync } from "../offline/background";
import { SyncEngine } from "../offline/sync";

type SessionState = "loading" | "signed_out" | "ready";

interface AppValue {
  session: SessionState;
  kind: SessionKind;
  online: boolean;
  version: number;
  notice: string | null;
  activate: () => Promise<void>;
  signOut: () => Promise<void>;
  sync: () => Promise<void>;
  touch: () => void;
  notify: (message: string | null) => void;
}

const AppContext = createContext<AppValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>("loading");
  const [kind, setKind] = useState<SessionKind>("operator");
  const [online, setOnline] = useState(true);
  const [version, setVersion] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(DEFAULT_SYNC_MINUTES);
  const engine = useRef<SyncEngine | null>(null);
  const onlineRef = useRef(true);

  const touch = useCallback(() => setVersion((value) => value + 1), []);

  const stopEngine = useCallback(() => {
    engine.current?.stop();
    engine.current = null;
  }, []);

  const startEngine = useCallback(async () => {
    stopEngine();
    engine.current = new SyncEngine({
      getToken,
      getDeviceId: deviceId,
      beforeSend: async () => {
        if ((await uploadPending(onlineRef.current)) > 0) touch();
      },
      onRejected: async (action, message) => {
        setNotice(message);
        await reloadAssignment(action.assignment_id).catch(() => undefined);
      },
      onConflict: (_action, message) => setNotice(message),
      onSessionExpired: () => setSession("signed_out"),
      refreshFromServer,
      onChange: touch,
    });
    await engine.current.start();
  }, [stopEngine, touch]);

  const activate = useCallback(async () => {
    const current = await sessionKind();
    setKind(current);
    setSession("ready");
    if (current === "operator") {
      await startEngine();
      setMinutes(await syncMinutes());
      void registerBackgroundSync();
    } else {
      stopEngine();
      void unregisterBackgroundSync();
    }
  }, [startEngine, stopEngine]);

  const signOut = useCallback(async () => {
    stopEngine();
    await unregisterBackgroundSync();
    await logout();
    setSession("signed_out");
  }, [stopEngine]);

  const sync = useCallback(async () => {
    if (engine.current) await engine.current.run();
    else if (kind === "operator") await refreshFromServer();
    touch();
  }, [touch, kind]);

  useEffect(() => {
    void (async () => {
      const token = await getToken();
      if (token) await activate();
      else setSession("signed_out");
    })();
    return stopEngine;
  }, [activate, stopEngine]);

  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        const next = Boolean(state.isConnected) && state.isInternetReachable !== false;
        onlineRef.current = next;
        setOnline(next);
      }),
    [],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void engine.current?.run();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (session !== "ready" || kind !== "operator") return;
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void engine.current?.run().then(touch);
    }, minutes * 60_000);
    return () => clearInterval(timer);
  }, [session, kind, minutes, touch]);

  const value = useMemo<AppValue>(() => ({ session, kind, online, version, notice, activate, signOut, sync, touch, notify: setNotice }), [session, kind, online, version, notice, activate, signOut, sync, touch]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppValue {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp fuera de AppProvider");
  return value;
}

export function useLocal<T>(load: () => Promise<T>, initial: T): T {
  const { version } = useApp();
  const [data, setData] = useState<T>(initial);
  useEffect(() => {
    let alive = true;
    void load().then((next) => {
      if (alive) setData(next);
    });
    return () => {
      alive = false;
    };
  }, [version, load]);
  return data;
}
