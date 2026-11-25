"use server";

import { revalidatePath } from "next/cache";
import { faqFromText } from "@/lib/landing-content";
import { type ConsoleResult, platformSend } from "@/lib/server/platformConsole";

const BASE = "/plataforma/marketing-vitrina";

const done = (result: ConsoleResult) => {
  if (result.done) {
    revalidatePath(BASE, "layout");
    revalidatePath("/software/blog", "layout");
  }
  return result;
};

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

const optional = (form: FormData, name: string) => text(form, name) || null;

const id = (form: FormData, name = "id") => encodeURIComponent(text(form, name));

export async function moderateComment(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return done(await platformSend(`/landing/comments/${id(form)}/moderate`, "POST", { status: text(form, "status") }, "No pudimos moderar el comentario.", () => "Comentario actualizado."));
}

export async function replyComment(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return done(await platformSend(`/landing/comments/${id(form)}/reply`, "POST", { body: text(form, "body") }, "No pudimos publicar la respuesta.", () => "Respuesta publicada como Equipo KipuControl."));
}

export async function deleteComment(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return done(await platformSend(`/landing/comments/${id(form)}`, "DELETE", {}, "No pudimos eliminar el comentario.", () => "Comentario eliminado."));
}

function popupBody(form: FormData) {
  return {
    name: text(form, "name"),
    trigger: text(form, "trigger"),
    kind: text(form, "kind"),
    pages: form.getAll("pages").map(String),
    freq_days: Number(text(form, "freq_days") || 7),
    eyebrow: optional(form, "eyebrow"),
    title: text(form, "title"),
    body: text(form, "body"),
    cta_label: text(form, "cta_label"),
    cta_href: optional(form, "cta_href"),
  };
}

export async function createPopup(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return done(await platformSend("/landing/popups", "POST", popupBody(form), "No pudimos crear el popup.", () => "Popup creado en borrador. Actívalo cuando quieras mostrarlo."));
}

export async function updatePopup(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return done(await platformSend(`/landing/popups/${id(form, "code")}`, "PATCH", popupBody(form), "No pudimos guardar el popup.", () => "Popup actualizado."));
}

export async function changePopupStatus(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return done(await platformSend(`/landing/popups/${id(form, "code")}/status`, "POST", { status: text(form, "status") }, "No pudimos cambiar el estado.", () => (text(form, "status") === "activo" ? "Popup activo en la página." : "Popup pausado.")));
}

export async function deletePopup(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return done(await platformSend(`/landing/popups/${id(form, "code")}`, "DELETE", {}, "No pudimos eliminar el popup.", () => "Popup eliminado."));
}

function postBody(form: FormData) {
  return {
    title: text(form, "title"),
    title_accent: optional(form, "title_accent"),
    slug: optional(form, "slug"),
    excerpt: text(form, "excerpt"),
    body: optional(form, "body"),
    category: optional(form, "category"),
    focus_keyword: text(form, "focus_keyword"),
    author_name: optional(form, "author_name"),
    author_role: optional(form, "author_role"),
    featured: form.get("featured") === "on",
    allow_comments: form.get("allow_comments") === "on",
    faq: faqFromText(text(form, "faq")),
  };
}

export async function createPost(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return done(await platformSend("/landing/posts", "POST", postBody(form), "No pudimos crear el artículo.", () => "Artículo guardado como borrador."));
}

export async function updatePost(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return done(await platformSend(`/landing/posts/${id(form)}`, "PATCH", postBody(form), "No pudimos guardar el artículo.", () => "Artículo guardado."));
}

export async function changePostStatus(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  const status = text(form, "status");
  return done(await platformSend(`/landing/posts/${id(form)}/status`, "POST", { status }, "No pudimos cambiar el estado del artículo.", () => (status === "publicado" ? "Artículo publicado en el blog." : status === "archivado" ? "Artículo archivado: ya no se ve en el blog." : "Artículo de vuelta en borrador.")));
}

export async function deletePost(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return done(await platformSend(`/landing/posts/${id(form)}`, "DELETE", {}, "No pudimos eliminar el artículo.", () => "Borrador eliminado."));
}
