import { FieldError } from "@/components/ui/FieldError";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { GUARDIAN_DOC_TYPES, GUARDIAN_RELATIONS } from "@/lib/claims";

export function GuardianFields({ errors = {} }: { errors?: Record<string, string | undefined> }) {
  return (
    <div className="grid gap-3 rounded-xl bg-surface-2 p-3.5 sm:grid-cols-2 animate-[rise-in_320ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
      <div className="sm:col-span-2">
        <TextField label="Nombre del padre, madre o apoderado" name="guardian_name" required minLength={5} maxLength={150} />
        <FieldError name="guardian_name" message={errors.guardian_name} />
      </div>
      <div className="grid grid-cols-[130px_1fr] gap-2">
        <SelectField label="Documento" name="guardian_doc_type" options={GUARDIAN_DOC_TYPES} defaultValue="DNI" />
        <div>
          <TextField label="Número" name="guardian_doc_number" required maxLength={15} />
          <FieldError name="guardian_doc_number" message={errors.guardian_doc_number} />
        </div>
      </div>
      <div>
        <SelectField label="Relación con el menor" name="guardian_relation" options={GUARDIAN_RELATIONS} defaultValue="Madre" />
        <FieldError name="guardian_relation" message={errors.guardian_relation} />
      </div>
    </div>
  );
}
