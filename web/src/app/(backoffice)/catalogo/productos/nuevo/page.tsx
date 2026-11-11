import { redirect } from "next/navigation";

export default function NuevoProductoPage() {
  redirect("/catalogo/productos?nuevo=1");
}
