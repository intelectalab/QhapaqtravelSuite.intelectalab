/**
 * Mapea errores de la API a React Hook Form (COMPONENTES.md: «errores 422 del API mapeados al campo por `field`»).
 *
 *  - 422 con `errors{campo:[msg]}` → setError(campo) (notación con puntos para anidados: `items.0.service_date`).
 *    Campos que el formulario no tiene → error raíz (no se pierden).
 *  - 422 con `code` de regla (sin `errors`) → error raíz «CODE · mensaje».
 *  - 409 → error raíz; si es STALE_VERSION, mensaje de recarga.
 *  - Otros → error raíz con correlation_id.
 * Devuelve true si el error se mostró en el formulario.
 */
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { isApiError } from "@/lib/api/errors";

export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  knownFields: readonly string[],
): boolean {
  if (!isApiError(error)) {
    setError("root.server", { type: "server", message: "No se pudo completar la operación. Revise su conexión." });
    return true;
  }

  if (error.isValidation && Object.keys(error.fieldErrors).length > 0) {
    const orphan: string[] = [];
    for (const [field, messages] of Object.entries(error.fieldErrors)) {
      const message = messages[0] ?? "Valor no válido.";
      if (knownFields.includes(field) || knownFields.some((k) => field.startsWith(k + "."))) {
        setError(field as Path<T>, { type: "server", message });
      } else {
        orphan.push(message);
      }
    }
    if (orphan.length) setError("root.server", { type: "server", message: orphan.join(" ") });
    return true;
  }

  if (error.isStale) {
    setError("root.server", {
      type: "conflict",
      message: "El registro fue modificado por otro usuario. Recargue para ver los cambios y vuelva a intentarlo.",
    });
    return true;
  }

  setError("root.server", { type: error.isConflict ? "conflict" : "server", message: error.userMessage() });
  return true;
}
