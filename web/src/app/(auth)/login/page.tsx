import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/AuthForms";
import { login } from "../actions";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return <LoginForm action={login} next={typeof next === "string" ? next : undefined} />;
}
