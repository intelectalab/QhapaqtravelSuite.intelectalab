import { AgencyWorkspace } from "@/components/shell/AgencyWorkspace";
import { PlatformWorkspace } from "@/components/shell/PlatformWorkspace";
import { sessionToken } from "@/lib/server/session";

export default async function BackofficeLayout({ children }: LayoutProps<"/">) {
  if (!(await sessionToken()) && (await sessionToken("platform"))) return <PlatformWorkspace />;
  return <AgencyWorkspace>{children}</AgencyWorkspace>;
}
