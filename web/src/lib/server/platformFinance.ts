import "server-only";
import type { FxCatalogOverview, OseCatalogOverview, TenantOse } from "@/lib/financeProviders";
import { platformGet } from "./platform";

export const getFxCatalog = () => platformGet<FxCatalogOverview>("/fx-providers");

export const getOseCatalog = () => platformGet<OseCatalogOverview>("/ose-providers");

export const getTenantOse = (code: string) => platformGet<TenantOse>(`/tenants/${encodeURIComponent(code)}/ose`);
