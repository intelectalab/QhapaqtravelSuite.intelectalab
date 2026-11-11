import "server-only";
import { cache } from "react";
import type { PlanRules, SubscriptionOverview } from "@/lib/admin";
import { getResource } from "./resource";

export const getSubscription = cache(async (): Promise<SubscriptionOverview | null> => getResource<SubscriptionOverview>("/billing/subscription", "No pudimos cargar la suscripción."));

export const getPlanRules = cache(async (): Promise<PlanRules | null> => getResource<PlanRules>("/billing/plan-rules", "No pudimos cargar los planes."));
