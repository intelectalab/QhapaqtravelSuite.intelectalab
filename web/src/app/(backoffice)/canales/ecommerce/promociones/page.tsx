import type { Metadata } from "next";
import { EcommerceWorkspace } from "@/features/channels/Ecommerce";
import { getEcommerce } from "@/lib/server/ecommerce";

export const metadata: Metadata = { title: "Promociones y códigos" };

export default async function EcommerceSectionPage() {
  const { overview, promotions } = await getEcommerce();
  if (!overview) return null;
  return (
    <>
      <EcommerceWorkspace overview={overview} promotions={promotions} section="promotions" />
    </>
  );
}
