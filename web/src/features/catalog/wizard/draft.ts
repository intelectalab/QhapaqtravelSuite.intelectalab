import { AVAILABILITY_LABEL, CHANNEL_INFO, type ProductDraft, type ProductEditorState, type ProductFormOptions, type ProductRateDraft } from "@/lib/catalog";

export type DraftPatch = Partial<ProductDraft>;

export type SectionSave = "master" | "components" | "itinerary" | "rates" | "seasons" | "availability" | "content" | "channels";

export const SECTION_OF_STEP: SectionSave[] = ["master", "master", "master", "components", "itinerary", "rates", "seasons", "availability", "content", "channels"];

export function emptyDraft(options: ProductFormOptions): ProductDraft {
  return {
    master: {
      name: "",
      internal_name: "",
      code: "",
      sku: "",
      type_id: "",
      category_id: "",
      subcategory_id: "",
      destination_id: "",
      short_description: "",
      duration_value: 1,
      duration_unit: "días",
      modality: "Compartido",
      minimum_passengers: 1,
      maximum_passengers: 12,
      minimum_age: 0,
      maximum_age: 85,
      booking_advance_min_days: 2,
      booking_advance_max_days: 365,
      is_bookable: true,
      is_quoteable: true,
      is_b2b: false,
      is_ecommerce: false,
      is_featured: false,
      markup_pct: options.sees_cost ? 25 : null,
    },
    secondary_destination_ids: [],
    main_provider_id: null,
    components: [],
    itinerary: [],
    rates: [],
    season_ids: [],
    availability: { model: "SIN_CONTROL", capacity: null, source: "interna" },
    content: { long_description: "", seo_title: "", seo_description: "", slug: "", video_url: "", inclusions: [], exclusions: [...options.defaults.exclusions], requirements: [], faqs: [], media: [] },
    policies: {
      cancellation: options.defaults.policies.cancellation ?? "",
      modification: options.defaults.policies.modification ?? "",
      no_show: options.defaults.policies.no_show ?? "",
      refund: options.defaults.policies.refund ?? "",
      penalties: options.defaults.policies.penalties ?? "",
      date_change: options.defaults.policies.date_change ?? "",
      penalty_tiers: options.defaults.policies.penalty_tiers ?? [],
    },
    channels: ["erp", "crm", "quotes"],
  };
}

export function draftFromState(state: ProductEditorState, options: ProductFormOptions): ProductDraft {
  const blank = emptyDraft(options);
  const text = (value: string | null | undefined) => value ?? "";
  return {
    master: { ...state.master, internal_name: text(state.master.internal_name), sku: text(state.master.sku), subcategory_id: text(state.master.subcategory_id), short_description: text(state.master.short_description) },
    secondary_destination_ids: [...state.secondary_destination_ids],
    main_provider_id: state.main_provider_id,
    components: state.components.map((component) => ({ ...component })),
    itinerary: state.itinerary.map((day) => ({ title: day.title, items: day.items.map((item) => ({ ...item })) })),
    rates: [],
    season_ids: [...state.season_ids],
    availability: { ...state.availability },
    content: {
      ...state.content,
      long_description: text(state.content.long_description),
      seo_title: text(state.content.seo_title),
      seo_description: text(state.content.seo_description),
      slug: text(state.content.slug),
      video_url: text(state.content.video_url),
      requirements: state.content.requirements.map((item) => ({ ...item })),
      faqs: state.content.faqs.map((item) => ({ ...item })),
      media: state.content.media.map((item) => ({ ...item })),
    },
    policies: state.policies ? { ...state.policies, penalties: text(state.policies.penalties), date_change: text(state.policies.date_change), penalty_tiers: (state.policies.penalty_tiers ?? []).map((tier) => ({ ...tier })) } : blank.policies,
    channels: state.channels.includes("erp") ? [...state.channels] : ["erp", ...state.channels],
  };
}

export function emptyRate(options: ProductFormOptions, suggestedCost: string | null): ProductRateDraft {
  return {
    rate_type: options.rates.types.includes("Venta") ? "Venta" : options.rates.types[0],
    segment: "Adulto",
    channel: "Directo",
    currency: "",
    price_basis: "Por persona",
    cost: suggestedCost,
    price: "",
    min_price: null,
    max_price: null,
    conditions: null,
    valid_from: options.today,
    valid_to: "",
    season_id: null,
  };
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function stepSummary(step: number, draft: ProductDraft, options: ProductFormOptions, rates: ProductRateDraft[]): string {
  const { master } = draft;
  const type = options.types.find((item) => item.id === master.type_id)?.name;
  switch (step) {
    case 0:
      return master.name ? [master.name, master.code, type?.toLocaleLowerCase("es")].filter(Boolean).join(" · ") : "Nombre, código, tipo, duración y pasajeros";
    case 1: {
      const category = options.categories.find((item) => item.id === master.category_id);
      const sub = category?.subcategories.find((item) => item.id === master.subcategory_id);
      return category ? [category.name, sub?.name].filter(Boolean).join(" › ") : "Categoría, subcategoría e indicadores comerciales";
    }
    case 2: {
      const destination = options.destinations.find((item) => item.id === master.destination_id);
      return destination ? `${destination.path}${draft.secondary_destination_ids.length ? ` · ${plural(draft.secondary_destination_ids.length, "destino secundario", "destinos secundarios")}` : ""}` : "Destino principal y secundarios";
    }
    case 3:
      return draft.components.length ? plural(draft.components.length, "componente", "componentes") : "Servicios de proveedores que forman el producto";
    case 4:
      return draft.itinerary.length ? `${plural(draft.itinerary.length, "día", "días")} · ${plural(draft.itinerary.reduce((sum, day) => sum + day.items.length, 0), "actividad", "actividades")}` : "Días y actividades";
    case 5:
      return rates.length ? [plural(rates.length, "tarifa", "tarifas"), rates.some((rate) => rate.state) ? plural(rates.filter((rate) => rate.state === "vigente").length, "vigente", "vigentes") : null].filter(Boolean).join(" · ") : "Precios por segmento, canal y vigencia";
    case 6: {
      const seasons = new Set([...draft.season_ids, ...rates.map((rate) => rate.season_id).filter((id): id is string => Boolean(id))]).size;
      return seasons ? plural(seasons, "temporada asociada", "temporadas asociadas") : "Temporadas que cambian tarifa o cupos";
    }
    case 7:
      return `${AVAILABILITY_LABEL[draft.availability.model] ?? draft.availability.model}${draft.availability.capacity ? ` · ${draft.availability.capacity} cupos` : ""}`;
    case 8:
      return [draft.content.inclusions.length && plural(draft.content.inclusions.length, "inclusión", "inclusiones"), draft.content.requirements.length && plural(draft.content.requirements.length, "requisito", "requisitos"), draft.content.faqs.length && plural(draft.content.faqs.length, "pregunta", "preguntas"), draft.content.media.length && plural(draft.content.media.length, "imagen", "imágenes")].filter(Boolean).join(" · ") || "Descripción, incluye, requisitos, políticas, fotos y preguntas";
    default:
      return draft.channels.map((channel) => CHANNEL_INFO[channel]?.label ?? channel).join(", ");
  }
}
