"use client";

/**
 * Muestra u oculta UI según permisos (spec 00 SEC-BR-14; COMPONENTES.md «Acciones sin permiso»).
 *
 *   <PermissionGate permission="reservations.cancel">
 *     <Button data-testid="reservation-cancel">Cancelar reserva</Button>
 *   </PermissionGate>
 *
 *   // Deshabilitado con tooltip cuando su ausencia confundiría al usuario:
 *   <PermissionGate permission={["finance.payments.register"]} mode="disable">
 *     <Button>Registrar pago</Button>
 *   </PermissionGate>
 *
 * NO es seguridad: si la acción llega a la API sin permiso, la API responde 403 y no cambia nada.
 * Montos sensibles: no se "ocultan" aquí; la API ya los omite del JSON (SEC-BR-13). Si el campo no viene, no se pinta.
 */
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { useAccess } from "@/lib/access/access-context";

type Props = {
  /** Uno o varios permisos («cualquiera de»). */
  permission: string | readonly string[];
  /** hide (por defecto) | disable: deshabilita el hijo y agrega el tooltip «Requiere permiso x.y». */
  mode?: "hide" | "disable";
  fallback?: ReactNode;
  children: ReactNode;
};

export function PermissionGate({ permission, mode = "hide", fallback = null, children }: Props) {
  const { can } = useAccess();
  if (can(permission)) return <>{children}</>;
  if (mode === "hide") return <>{fallback}</>;

  const needed = typeof permission === "string" ? permission : permission.join(" | ");
  const title = `Requiere permiso ${needed}`;
  if (isValidElement(children)) {
    const child = children as ReactElement<{ disabled?: boolean; title?: string; "aria-disabled"?: boolean }>;
    // span envolvente: los botones deshabilitados no disparan eventos de puntero y el tooltip no aparecería.
    return (
      <span title={title} className="inline-flex cursor-not-allowed">
        {cloneElement(child, { disabled: true, "aria-disabled": true, title })}
      </span>
    );
  }
  return <span title={title}>{children}</span>;
}
