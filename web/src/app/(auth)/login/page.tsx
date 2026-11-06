import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/AuthForms";
import { login } from "../actions";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, activada } = await searchParams;
  return (
    <LoginForm
      action={login}
      next={typeof next === "string" ? next : undefined}
      title={typeof activada === "string" ? "Tu cuenta está lista" : undefined}
      description={typeof activada === "string" ? "Entra con tu correo y la contraseña que acabas de crear." : undefined}
    />
  );
}
