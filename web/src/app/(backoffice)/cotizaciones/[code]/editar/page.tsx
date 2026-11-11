import { redirect } from "next/navigation";

export default async function EditarCotizacionPage({ params }: PageProps<"/cotizaciones/[code]/editar">) {
  const { code } = await params;
  redirect(`/cotizaciones/${encodeURIComponent(code)}?editar=1`);
}
