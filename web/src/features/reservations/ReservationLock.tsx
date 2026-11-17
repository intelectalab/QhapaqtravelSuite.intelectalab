"use client";

import { createContext, useContext, type ReactNode } from "react";

const ReservationLockContext = createContext<number | null>(null);

export function ReservationLockScope({ version, children }: { version: number; children: ReactNode }) {
  return <ReservationLockContext.Provider value={version}>{children}</ReservationLockContext.Provider>;
}

export function useReservationLock() {
  return useContext(ReservationLockContext);
}

export function ReservationLockInput() {
  const version = useReservationLock();
  return version === null ? null : <input type="hidden" name="lock_version" value={version} />;
}
