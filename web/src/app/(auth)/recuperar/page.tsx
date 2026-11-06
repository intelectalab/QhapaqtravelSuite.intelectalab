import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/features/auth/PasswordForms";
import { requestPasswordReset } from "./actions";

export const metadata: Metadata = { title: "Recupera tu acceso" };

export default function RecuperarPage() {
  return <ForgotPasswordForm action={requestPasswordReset} />;
}
