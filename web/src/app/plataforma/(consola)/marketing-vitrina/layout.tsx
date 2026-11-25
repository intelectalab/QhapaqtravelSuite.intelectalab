import { BookOpen, Building2, Eye, Mail, MessagesSquare, Newspaper, PanelTop, Rocket, Target } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { PathSectionNav } from "@/components/ui/PathSectionNav";
import { SectionLayout } from "@/components/ui/SectionNav";

const BASE = "/plataforma/marketing-vitrina";

export default function MarketingVitrinaLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader
        title="Marketing de la vitrina"
        subtitle="Visitas y conversiones de Rutas Libres, y la captación de la landing de KipuControl: altas, blog, comentarios, popups y boletín."
        info={<InfoTip>Las visitas se cuentan sin cookies en la vitrina y el blog. Las etiquetas de la vitrina se activan solo con la aprobación de otro Super Admin.</InfoTip>}
      />
      <SectionLayout
        nav={
          <PathSectionNav
            label="Secciones de marketing de la vitrina"
            groups={[
              { title: "Medición", items: [
                { href: BASE, label: "Visitas", icon: <Eye size={16} /> },
                { href: `${BASE}/agencias`, label: "Por agencia", icon: <Building2 size={16} /> },
              ] },
              { title: "Configuración", items: [
                { href: `${BASE}/etiquetas`, label: "Etiquetas y conversiones", icon: <Target size={16} /> },
                { href: `${BASE}/blog`, label: "Blog en Payload", icon: <BookOpen size={16} /> },
              ] },
              { title: "Landing de KipuControl", items: [
                { href: `${BASE}/altas`, label: "Altas desde la landing", icon: <Rocket size={16} /> },
                { href: `${BASE}/articulos`, label: "Artículos del blog", icon: <Newspaper size={16} /> },
                { href: `${BASE}/comentarios`, label: "Comentarios", icon: <MessagesSquare size={16} /> },
                { href: `${BASE}/popups`, label: "Popups", icon: <PanelTop size={16} /> },
                { href: `${BASE}/boletin`, label: "Boletín", icon: <Mail size={16} /> },
              ] },
            ]}
          />
        }
      >
        {children}
      </SectionLayout>
    </>
  );
}
