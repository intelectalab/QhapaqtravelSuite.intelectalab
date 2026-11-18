import { Link2Off } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SupplierShell } from "@/features/supplier-portal/SupplierShell";
import { currentUser } from "@/lib/server/me";
import { SUPPLIER_HOME, supplierSession } from "./data";

export const metadata: Metadata = { title: { default: "Extranet de proveedores", template: "%s · Extranet" } };

export default async function SupplierLayout({ children }: { children: ReactNode }) {
  const me = await currentUser();
  if (me.home !== SUPPLIER_HOME) redirect(me.home);
  const session = await supplierSession();

  return (
    <SupplierShell session={session}>
      {session ? (
        children
      ) : (
        <Card className="mx-auto mt-10 max-w-xl">
          <EmptyState icon={<Link2Off size={22} />} title="Tu usuario no está vinculado a un proveedor" description="Pide a la agencia que vincule tu usuario a la ficha de tu empresa. Mientras tanto no verás solicitudes ni pagos." />
        </Card>
      )}
    </SupplierShell>
  );
}
