import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { signupStatus } from "@/app/(software)/software/suscribirse/actions";
import { SignupStatusView } from "@/features/software/SignupStatusView";

export const metadata: Metadata = { title: "Tu alta en KipuControl", robots: { index: false, follow: false } };

export default async function BienvenidoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const status = await signupStatus(decodeURIComponent(token));
  if (!status) notFound();

  return (
    <section className="relative isolate overflow-hidden">
      <span aria-hidden className="ambient-glow absolute inset-0 -z-10" />
      <div className="mx-auto max-w-[1100px] px-5 py-12 sm:px-8 sm:py-16">
        <SignupStatusView token={decodeURIComponent(token)} status={status} />
      </div>
    </section>
  );
}
