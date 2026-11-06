import { SiteFrame } from "@/features/software/SiteFrame";

export default function SoftwareLayout({ children }: LayoutProps<"/">) {
  return <SiteFrame>{children}</SiteFrame>;
}
