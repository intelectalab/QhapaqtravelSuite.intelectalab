"use server";

import { AGENCY_TARGET, changeArticle, createArticle, saveArticle } from "@/lib/server/help";
import type { StepResult } from "@/lib/server/resource";

export async function createHelpArticle(_state: StepResult, form: FormData): Promise<StepResult> {
  return createArticle(AGENCY_TARGET, form);
}

export async function saveHelpArticle(_state: StepResult, form: FormData): Promise<StepResult> {
  return saveArticle(AGENCY_TARGET, form);
}

export async function archiveHelpArticle(_state: StepResult, form: FormData): Promise<StepResult> {
  return changeArticle(AGENCY_TARGET, form, "archive");
}

export async function restoreHelpArticle(_state: StepResult, form: FormData): Promise<StepResult> {
  return changeArticle(AGENCY_TARGET, form, "restore");
}

export async function originalHelpArticle(_state: StepResult, form: FormData): Promise<StepResult> {
  return changeArticle(AGENCY_TARGET, form, "adaptation");
}
