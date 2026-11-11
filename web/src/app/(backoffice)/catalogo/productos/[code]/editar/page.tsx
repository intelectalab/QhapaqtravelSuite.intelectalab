import { redirect } from "next/navigation";

export default async function EditarProductoPage({ params }: PageProps<"/catalogo/productos/[code]/editar">) {
  const { code } = await params;
  redirect(`/catalogo/productos/${encodeURIComponent(code)}?editar=1`);
}
