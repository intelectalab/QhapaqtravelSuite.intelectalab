import { Compass } from "lucide-react";
import Link from "next/link";
import { rlPath } from "@/lib/rutas-libres";
import { rlBase } from "@/lib/server/rutas-libres";

export default async function RutasLibresNotFound() {
  const base = await rlBase();
  return (
    <section className="rl-wrap pt-20">
      <div className="rl-panel mx-auto flex max-w-[620px] flex-col items-center p-10 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--rl-cobalt-soft)] text-[var(--rl-cobalt)]"><Compass size={26} /></span>
        <h1 className="rl-h2 mt-5">Esta ruta no existe</h1>
        <p className="rl-muted mt-3 text-[15px]">El tour o el artículo ya no está publicado, o el enlace cambió. Explore los destinos disponibles.</p>
        <Link href={rlPath(base)} className="rl-cta mt-7">Ver free tours</Link>
      </div>
    </section>
  );
}
