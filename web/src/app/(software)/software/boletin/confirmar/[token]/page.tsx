import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { NewsletterNotice } from "@/features/software/blog/NewsletterNotice";
import { confirmNewsletter } from "@/app/(software)/software/actions";

export const metadata: Metadata = { title: "Confirmar suscripción", robots: { index: false, follow: false } };

export default async function ConfirmNewsletterPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await confirmNewsletter(token);

  return result.ok ? (
    <NewsletterNotice tone="ok" title="Suscripción confirmada" actions={<Button href="/software/blog" variant="primary">Ir al blog</Button>}>
      <p>{result.message}</p>
      {result.email && <p className="mt-2 font-mono text-[13px] text-fg-3">{result.email}</p>}
    </NewsletterNotice>
  ) : (
    <NewsletterNotice tone="bad" title="No pudimos confirmar" actions={<Button href="/software/blog">Volver al blog</Button>}>
      <p>{result.message}</p>
    </NewsletterNotice>
  );
}
