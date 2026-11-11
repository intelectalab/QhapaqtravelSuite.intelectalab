import { StatusBadge } from "@/components/ui/Badge";
import { ArcoForm, ProfileForm } from "@/features/site/Account";
import { formatDate } from "@/lib/format";
import { requireAccount } from "@/lib/server/site";
import type { AccountMe } from "@/lib/site";

export default async function AccountDataPage({ params }: PageProps<"/sitio/[agencia]/cuenta/datos">) {
  const { agencia } = await params;
  const me = await requireAccount<AccountMe>(agencia, "/me");

  return (
    <>
      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="text-[17px] font-bold tracking-tight text-fg">Datos personales</h2>
        <p className="mb-4 text-[13px] text-fg-3">Ingresas con {me.login_email}. Cliente {me.code}.</p>
        <ProfileForm me={me} />
      </section>

      {!me.passenger && (
        <section className="rounded-card border border-line bg-surface p-5 shadow-card">
          <h2 className="text-[17px] font-bold tracking-tight text-fg">Tus derechos sobre tus datos</h2>
          <p className="mb-4 text-[13px] leading-relaxed text-fg-3">Puedes pedir acceso, rectificación, cancelación u oposición al uso de tus datos personales (Ley 29733). Respondemos dentro del plazo legal.</p>
          <ArcoForm types={me.arco_types} />
          {me.arco_requests.length > 0 && (
            <ul className="mt-5 grid gap-2 border-t border-line pt-4">
              {me.arco_requests.map((request) => (
                <li key={request.code} className="flex flex-wrap items-center justify-between gap-2 text-[13.5px]">
                  <span>
                    <b className="font-semibold text-fg">{request.subject}</b>
                    <span className="block text-[12px] text-fg-3">
                      {request.code} · enviada el {formatDate(request.created_at)}
                      {request.due_date ? ` · respuesta hasta el ${formatDate(request.due_date)}` : ""}
                    </span>
                  </span>
                  <StatusBadge status={request.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
