export const AGENCY_PREVIEW_RETURN = "kipucontrol_preview_return";

export const PREVIEW_BACK_COOKIE = "kipucontrol_preview_back";

export const AGENCY_PREVIEW_EXIT = "/agencia/vista-previa/salir";

export const PORTAL_PREVIEW_EXIT = "/portal/vista-previa/salir";

export const AGENCY_PREVIEW_BACK = "/canales/b2b";

export const PASSENGER_PREVIEW_BACK = "/canales/portal-pasajero";

export function previewBack(value: string | undefined): string {
  return value && value.startsWith("/canales/") && !value.startsWith("//") ? value : AGENCY_PREVIEW_BACK;
}
