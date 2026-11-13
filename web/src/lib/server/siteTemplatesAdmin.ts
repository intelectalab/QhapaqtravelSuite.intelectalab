import "server-only";
import { cache } from "react";
import type { AiPack, TemplatesAdminOverview, TemplateSubmission } from "@/lib/siteTemplates";
import { platformGet } from "./platform";

export const getTemplatesAdmin = cache(() => platformGet<TemplatesAdminOverview>("/templates"));

export const getTemplateSubmissions = cache(() => platformGet<TemplateSubmission[]>("/template-submissions"));

export const getPlatformAiPacks = cache(() => platformGet<AiPack[]>("/ai/packs"));
