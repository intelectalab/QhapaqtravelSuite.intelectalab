"use client";

import { Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FinanceStep } from "./FinanceStep";

export function SettlementCloseAction({ code, disabled }: { code: string; disabled: boolean }) {
  if (disabled) {
    return (
      <Button size="sm" variant="secondary" icon={<Lock size={15} />} disabled title="Completa los puntos pendientes para liquidar.">
        Cerrar liquidación
      </Button>
    );
  }
  return (
    <FinanceStep step="settlement_close" itemKey={code} label="Cerrar liquidación" icon={<Lock size={16} />} title={`Cerrar la liquidación de ${code}`} description="Guarda el estado de resultados de la reserva tal como está hoy. Después ya no cambia." submitLabel="Cerrar liquidación" trigger={(open) => <Button size="sm" variant="primary" icon={<Lock size={15} />} onClick={open}>Cerrar liquidación</Button>} />
  );
}
