import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/AuthForms";
import { login } from "../actions";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, activada, restablecida } = await searchParams;
  const ready = typeof activada === "string" || typeof restablecida === "string";
  return (
    <LoginForm
      action={login}
      next={typeof next === "string" ? next : undefined}
      title={typeof restablecida === "string" ? "Contraseña actualizada" : ready ? "Tu cuenta está lista" : undefined}
      description={ready ? "Entra con tu correo y la contraseña que acabas de crear." : undefined}
      recoverHref="/recuperar"
    />
  );
}
