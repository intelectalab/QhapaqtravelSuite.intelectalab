import { formatMoney } from "@/lib/format";
import { maxSaving, trialDays, type PlansCatalog } from "@/lib/software";
import type { FaqItem } from "./Faq";

function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

export function buildFaq(catalog: PlansCatalog): FaqItem[] {
  const { plans, addons, currency } = catalog;
  const days = trialDays(plans);
  const saving = maxSaving(plans);
  const cheapest = plans[0];
  const unlimited = plans.find((plan) => plan.limits.users === null);
  const sellable = addons.filter((addon) => Object.values(addon.plans).some((offer) => offer.status === "available"));
  const rulesTotal = plans[0]?.rules_total ?? 0;

  return [
    {
      question: "¿Cómo funciona la prueba gratuita?",
      answer: `Tienes ${days} días con todas las funciones del plan que elijas, sin registrar tarjeta. Creamos el espacio de tu agencia y, al terminar, registras tu medio de pago solo si decides continuar.`,
    },
    {
      question: "¿Cuánto ahorro si pago el año completo?",
      answer: `Hasta ${saving} %. ${plans.map((plan) => `${plan.name} cuesta ${formatMoney(plan.price_year, plan.currency)} al año en lugar de ${formatMoney(plan.price_month * 12, plan.currency)}`).join("; ")}.`,
    },
    {
      question: "¿Puedo cambiar de plan más adelante?",
      answer: `Sí. Puedes subir de plan en cualquier momento desde Suscripción y uso, y las funciones nuevas se activan al instante. ${cheapest ? `El plan de entrada, ${cheapest.name}, empieza en ${formatMoney(cheapest.price_month, cheapest.currency)} al mes.` : ""}`.trim(),
    },
    {
      question: "¿Qué pasa si mi equipo crece?",
      answer: `Cada plan define usuarios, sedes y reservas al mes. ${unlimited ? `${unlimited.name} no tiene límite de usuarios ni de sedes.` : ""} También puedes sumar usuarios o paquetes adicionales sin cambiar de plan.`.replace(/\s+/g, " "),
    },
    {
      question: "¿Qué adicionales puedo contratar?",
      answer: sellable.length > 0 ? `${list(sellable.map((addon) => addon.label.toLowerCase()))}. Se suman a tu mensualidad y los activas cuando los necesites.` : `Todos los planes incluyen lo necesario para operar; los adicionales se cotizan aparte en ${currency}.`,
    },
    {
      question: "¿Qué son las reglas de reserva?",
      answer: `Son ${rulesTotal} reglas que controlan cómo vendes: anticipación mínima, adelantos, grupos mínimos, descuentos por temporada, datos de pasajeros y más. Cada plan activa un conjunto y los superiores heredan las del anterior.`,
    },
    {
      question: "¿Mis datos están separados de otras agencias?",
      answer: "Sí. Cada agencia trabaja en su propio espacio con aislamiento a nivel de base de datos, permisos por rol, verificación en dos pasos y auditoría de cada cambio importante.",
    },
  ];
}
