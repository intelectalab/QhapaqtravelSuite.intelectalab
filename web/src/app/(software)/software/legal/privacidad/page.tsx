import type { Metadata } from "next";
import { LegalDocument } from "@/features/software/LegalDocument";
import { PRIVACY } from "@/features/software/legal-texts";
import { softwareOrigin } from "@/lib/server/landing-content";

export async function generateMetadata(): Promise<Metadata> {
  return { title: PRIVACY.title, description: PRIVACY.summary, alternates: { canonical: `${await softwareOrigin()}/software/legal/privacidad` } };
}

export default function PrivacyPage() {
  return <LegalDocument text={PRIVACY} current="/software/legal/privacidad" />;
}
