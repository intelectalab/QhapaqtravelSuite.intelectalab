import { AuthFrame } from "@/components/shell/AuthFrame";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <AuthFrame
      headline={
        <>
          Toda tu agencia,
          <br />
          del primer contacto
          <br />
          <span className="text-t2">al regreso del viaje.</span>
        </>
      }
      description="Clientes, cotizaciones, reservas, operaciones y cobros en un solo lugar, con la información de tu equipo siempre al día."
      footnote="Qhapaq Ñan: el camino que lo une todo."
    >
      {children}
    </AuthFrame>
  );
}
