import { CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/features/auth/PasswordForms";
import { resetPassword } from "../../recuperar/actions";

export const metadata: Metadata = { title: "Nueva contraseña" };

export default async function RestablecerPage({ params, searchParams }: PageProps<"/restablecer/[token]">) {
  const { token } = await params;
  const { email } = await searchParams;

  if (typeof email !== "string" || email === "") {
    return (
      <div className="flex flex-col gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-bad/10 text-bad">
          <CircleAlert size={24} />
        </span>
        <h2 className="text-[28px] font-bold tracking-[-0.035em]">El enlace está incompleto</h2>
        <p className="text-fg-3">Abre el enlace completo del correo o pide uno nuevo.</p>
        <Link href="/recuperar" className="text-[14px] font-semibold text-accent hover:underline">
          Pedir un enlace nuevo
        </Link>
      </div>
    );
  }

  return <ResetPasswordForm action={resetPassword} token={token} email={email} />;
}
