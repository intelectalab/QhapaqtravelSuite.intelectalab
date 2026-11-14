import type { ReactNode } from "react";
import { AgencyWorkspace } from "@/components/shell/AgencyWorkspace";
import { PlatformWorkspace } from "@/components/shell/PlatformWorkspace";
import { sessionToken } from "@/lib/server/session";

export default async function PlatformConsoleLayout({ children }: { children: ReactNode }) {
  if (!(await sessionToken("platform")) && (await sessionToken())) return <AgencyWorkspace />;
  return <PlatformWorkspace>{children}</PlatformWorkspace>;
}
