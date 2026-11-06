import { CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { InvitationForm } from "@/features/auth/InvitationForm";
import { apiFetch } from "@/lib/server/api";
import { acceptInvitation } from "../actions";

export const metadata: Metadata = { title: "Activa tu cuenta" };

interface Invitation {
  name: string;
  email: string;
  agency: string;
}

export default async function InvitacionPage({ params }: PageProps<"/invitacion/[token]">) {
  const { token } = await params;
  const result = await apiFetch<Invitation>(`/auth/invitations/${encodeURIComponent(token)}`, { auth: false });

  if (!result.ok || !result.data) {
    return (
      <div className="flex flex-col gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-bad/10 text-bad">
          <CircleAlert size={24} />
        </span>
        <h2 className="text-[28px] font-bold tracking-[-0.035em]">No pudimos abrir la invitación</h2>
        <p className="text-fg-3">{result.error?.message ?? "El enlace no es válido."}</p>
        <Link href="/login" className="text-[14px] font-semibold text-accent hover:underline">
          Ir a iniciar sesión
        </Link>
      </div>
    );
  }

  return <InvitationForm action={acceptInvitation} token={token} name={result.data.name} email={result.data.email} agency={result.data.agency} />;
}
