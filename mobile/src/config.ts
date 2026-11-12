export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000/api/v1").replace(/\/+$/, "");

export const APP_VERSION = "1.0.0";

export const TENANT_HOST = process.env.EXPO_PUBLIC_TENANT_HOST ?? "";

export const INCIDENT_TYPES = ["Transporte", "Proveedor", "Salud del pasajero", "Horario", "Clima", "Documentación", "Equipaje", "Seguridad", "Capacidad", "Pasajero", "Otro"] as const;

export const SEVERITIES = [
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" },
] as const;
