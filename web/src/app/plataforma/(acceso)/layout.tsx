import type { ReactNode } from "react";
import { AuthFrame } from "@/components/shell/AuthFrame";

export default function PlatformAccessLayout({ children }: { children: ReactNode }) {
  return (
    <AuthFrame
      headline={
        <>
          Consola de
          <br />
          <span className="text-t2">plataforma.</span>
        </>
      }
      description="Agencias, planes, facturación de la plataforma y auditoría de seguridad. Los datos comerciales de cada agencia quedan fuera de esta consola."
      footnote="Acceso exclusivo para la administración de KipuControl."
    >
      {children}
    </AuthFrame>
  );
}
