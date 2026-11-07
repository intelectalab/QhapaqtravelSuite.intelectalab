export function FieldError({ name, message }: { name?: string; message?: string | null }) {
  if (!message) return null;

  return (
    <p role="alert" data-testid={name ? `field-error:${name}` : undefined} className="mt-1.5 text-[12.5px] font-medium text-bad">
      {message}
    </p>
  );
}
