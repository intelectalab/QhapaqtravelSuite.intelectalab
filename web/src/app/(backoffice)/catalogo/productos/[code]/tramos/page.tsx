import { redirect } from "next/navigation";

export default async function ProductTripPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  redirect(`/catalogo/productos/${encodeURIComponent(code)}?seccion=tramos`);
}
