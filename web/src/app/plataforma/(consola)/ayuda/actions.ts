"use server";

import { changeArticle, createArticle, PLATFORM_TARGET, saveArticle } from "@/lib/server/help";
import type { StepResult } from "@/lib/server/resource";

export async function createPlatformHelpArticle(_state: StepResult, form: FormData): Promise<StepResult> {
  return createArticle(PLATFORM_TARGET, form);
}

export async function savePlatformHelpArticle(_state: StepResult, form: FormData): Promise<StepResult> {
  return saveArticle(PLATFORM_TARGET, form);
}

export async function archivePlatformHelpArticle(_state: StepResult, form: FormData): Promise<StepResult> {
  return changeArticle(PLATFORM_TARGET, form, "archive");
}

export async function restorePlatformHelpArticle(_state: StepResult, form: FormData): Promise<StepResult> {
  return changeArticle(PLATFORM_TARGET, form, "restore");
}
