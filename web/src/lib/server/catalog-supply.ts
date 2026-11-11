import "server-only";
import { cache } from "react";
import type { ProviderDetail } from "@/lib/catalog-providers";
import type { ServiceDetail } from "@/lib/catalog-services";
import { getResource } from "./resource";

export const getService = cache(async (ref: string) => getResource<ServiceDetail>(`/catalog/services/${encodeURIComponent(ref)}`, "No pudimos cargar el servicio."));

export const getProvider = cache(async (ref: string) => getResource<ProviderDetail>(`/catalog/providers/${encodeURIComponent(ref)}`, "No pudimos cargar el proveedor."));
