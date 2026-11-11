import { Suspense, type ReactNode } from "react";
import { SectionLayout } from "@/components/ui/SectionNav";
import { listRoles } from "@/lib/server/users";
import { RolesNav } from "./RolesNav";

export async function RolesLayout({ children }: { children: ReactNode }) {
  const data = await listRoles();
  return (
    <SectionLayout
      nav={
        <Suspense>
          <RolesNav roles={data?.roles ?? []} />
        </Suspense>
      }
    >
      {children}
    </SectionLayout>
  );
}
