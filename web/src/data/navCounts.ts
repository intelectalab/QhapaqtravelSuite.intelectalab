import type { NavCountKey } from "@/config/navigation";
import activitiesSeed from "./seed/activities.json";
import incidentsSeed from "./seed/incidents.json";
import leadsSeed from "./seed/leads.json";
import quotesSeed from "./seed/quotes.json";

const OPEN_QUOTE = new Set(["enviada", "vista", "negociacion"]);
const CLOSED_INCIDENT = new Set(["cerrada", "resuelta"]);

export const NAV_COUNTS: Record<NavCountKey, number> = {
  leads: leadsSeed.filter((lead) => lead.status === "nuevo").length,
  activities: activitiesSeed.filter((activity) => activity.status !== "completada").length,
  quotes: quotesSeed.filter((quote) => OPEN_QUOTE.has(quote.status)).length,
  incidents: incidentsSeed.filter((incident) => !CLOSED_INCIDENT.has(incident.status)).length,
};
