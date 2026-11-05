import "server-only";
import { cookies } from "next/headers";
import { REALMS, type Realm } from "@/lib/realms";

const secure = process.env.NODE_ENV === "production";

const options = (realm: Realm, maxAge: number) => ({ httpOnly: true, sameSite: "lax" as const, secure, path: REALMS[realm].path, maxAge });

export async function sessionToken(realm: Realm = "agency"): Promise<string | null> {
  return (await cookies()).get(REALMS[realm].session)?.value ?? null;
}

export async function startSession(token: string, mfaPending: boolean, realm: Realm = "agency"): Promise<void> {
  const store = await cookies();
  const { session, mfa } = REALMS[realm];
  store.set(session, token, options(realm, 60 * 60 * REALMS[realm].hours));
  if (mfaPending) store.set(mfa, "1", options(realm, 60 * 10));
  else store.delete({ name: mfa, path: REALMS[realm].path });
}

export async function completeMfa(realm: Realm = "agency"): Promise<void> {
  (await cookies()).delete({ name: REALMS[realm].mfa, path: REALMS[realm].path });
}

export async function endSession(realm: Realm = "agency"): Promise<void> {
  const store = await cookies();
  store.delete({ name: REALMS[realm].session, path: REALMS[realm].path });
  store.delete({ name: REALMS[realm].mfa, path: REALMS[realm].path });
}
