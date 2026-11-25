import type { Metadata } from "next";
import { UnsubscribeForm } from "@/features/software/blog/NewsletterNotice";

export const metadata: Metadata = { title: "Darse de baja del boletín", robots: { index: false, follow: false } };

export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <UnsubscribeForm token={token} />;
}
