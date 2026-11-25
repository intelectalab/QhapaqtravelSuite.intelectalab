import type { Metadata } from "next";
import { LegalDocument } from "@/features/software/LegalDocument";
import { TERMS } from "@/features/software/legal-texts";
import { softwareOrigin } from "@/lib/server/landing-content";

export async function generateMetadata(): Promise<Metadata> {
  return { title: TERMS.title, description: TERMS.summary, alternates: { canonical: `${await softwareOrigin()}/software/legal/terminos` } };
}

export default function TermsPage() {
  return <LegalDocument text={TERMS} current="/software/legal/terminos" />;
}
