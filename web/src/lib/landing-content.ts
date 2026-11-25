export type BlogSite = "kipucontrol" | "rutaslibres";

export interface BlogCard {
  id: string;
  slug: string;
  site: BlogSite;
  site_label: string;
  title: string;
  title_accent: string | null;
  excerpt: string;
  category: string | null;
  category_label: string | null;
  keyword: string;
  author: string;
  author_role: string | null;
  published_at: string;
  reading_minutes: number;
  reads: number;
  featured: boolean;
  href: string;
}

export interface BlogOption {
  value: string;
  label: string;
  count?: number;
  site?: BlogSite;
}

export interface BlogList {
  items: BlogCard[];
  featured: BlogCard | null;
  popular: BlogCard[];
  categories: (BlogOption & { site: BlogSite; count: number })[];
  sites: (BlogOption & { count: number })[];
  orders: BlogOption[];
  filters: { site: BlogSite | null; category: string | null; q: string | null; order: string };
  total: number;
}

export interface BlogComment {
  id: string;
  code: string;
  name: string;
  body: string;
  useful: number;
  staff: boolean;
  created_at: string;
}

export interface BlogThread extends BlogComment {
  replies: BlogComment[];
}

export interface BlogFaq {
  q: string;
  a: string;
}

export interface BlogPost extends BlogCard {
  body: string;
  faq: BlogFaq[];
  allow_comments: boolean;
  useful: { yes: number; no: number };
  comments: BlogThread[];
  comment_count: number;
  related: BlogCard[];
  updated_at: string;
}

export type PopupTrigger = "salida" | "scroll_60" | "tiempo_30s";

export type PopupKind = "prueba" | "boletin" | "enlace";

export type PopupPage = "inicio" | "planes" | "modulos" | "blog" | "articulo" | "agencias" | "contacto";

export interface PublicPopup {
  code: string;
  trigger: PopupTrigger;
  kind: PopupKind;
  freq_days: number;
  eyebrow: string | null;
  title: string;
  body: string;
  cta_label: string;
  cta_href: string | null;
}

export type NewsletterSource = "pie" | "blog" | "scroll_60" | "popup_salida";

export interface FormResult {
  ok: boolean;
  message: string;
  errors?: Record<string, string>;
  status?: string;
}

export const BLOG_BASE = "/software/blog";

export type ArticleBlock =
  | { kind: "heading"; id: string; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "tip"; title: string; text: string }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "mock"; name: string };

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const cells = (line: string) =>
  line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());

export function parseArticle(body: string): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    const last = blocks[blocks.length - 1];
    if (line === "") continue;
    if (line.startsWith("#")) {
      const text = line.replace(/^#+\s*/, "");
      blocks.push({ kind: "heading", id: slugify(text), text });
    } else if (line.startsWith("- ")) {
      if (last?.kind === "list") last.items.push(line.slice(2));
      else blocks.push({ kind: "list", items: [line.slice(2)] });
    } else if (line.startsWith(">")) {
      const content = line.replace(/^>\s*/, "");
      const split = content.indexOf(":");
      blocks.push(split > 0 && split < 60 ? { kind: "tip", title: content.slice(0, split).trim(), text: content.slice(split + 1).trim() } : { kind: "tip", title: "Consejo", text: content });
    } else if (line.startsWith("|")) {
      if (last?.kind === "table") last.rows.push(cells(line));
      else blocks.push({ kind: "table", head: cells(line), rows: [] });
    } else if (/^\[\[maqueta:[a-z-]+\]\]$/.test(line)) {
      blocks.push({ kind: "mock", name: line.slice(10, -2) });
    } else {
      blocks.push({ kind: "paragraph", text: line });
    }
  }
  return blocks;
}

export function articleOutline(body: string): { id: string; text: string }[] {
  return parseArticle(body).flatMap((block) => (block.kind === "heading" ? [{ id: block.id, text: block.text }] : []));
}

export function blogHref(filters: { site?: string | null; category?: string | null; q?: string | null; order?: string | null }): string {
  const params = new URLSearchParams();
  if (filters.site) params.set("sitio", filters.site);
  if (filters.q) params.set("q", filters.q);
  if (filters.order && filters.order !== "recientes") params.set("orden", filters.order);
  const query = params.toString();
  const base = filters.category ? `${BLOG_BASE}/categoria/${filters.category}` : BLOG_BASE;
  return query === "" ? base : `${base}?${query}`;
}

export function formatReads(reads: number): string {
  return reads >= 1000 ? `${(reads / 1000).toLocaleString("es-PE", { maximumFractionDigits: 1 })} k lecturas` : `${reads} ${reads === 1 ? "lectura" : "lecturas"}`;
}

export function popupPage(pathname: string): PopupPage | null {
  if (pathname === "/" || pathname === "/software") return "inicio";
  if (pathname.startsWith("/software/suscribirse") || pathname.startsWith("/software/bienvenido") || pathname.startsWith("/software/boletin") || pathname.startsWith("/software/legal")) return null;
  if (pathname.startsWith(`${BLOG_BASE}/categoria`) || pathname === BLOG_BASE) return "blog";
  if (pathname.startsWith(`${BLOG_BASE}/`)) return "articulo";
  const page = pathname.replace("/software/", "");
  return (["planes", "modulos", "agencias", "contacto"] as const).find((candidate) => page.startsWith(candidate)) ?? null;
}

export const SIGNUP_EMAIL_KEY = "kipu_signup_email";

export function rememberSignupEmail(email: string) {
  try {
    window.sessionStorage.setItem(SIGNUP_EMAIL_KEY, email);
  } catch {}
}

export function signupEmail(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.sessionStorage.getItem(SIGNUP_EMAIL_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function popupDue(lastShown: string | null, freqDays: number, now = Date.now()): boolean {
  if (!lastShown) return true;
  const shown = Number(lastShown);
  return !Number.isFinite(shown) || now - shown >= freqDays * 86_400_000;
}

export interface Choice {
  value: string;
  label: string;
}

export type CommentStatus = "pendiente" | "aprobado" | "rechazado" | "spam";

export interface ConsoleComment {
  id: string;
  code: string;
  name: string;
  email: string | null;
  body: string;
  status: CommentStatus;
  status_label: string;
  actions: Choice[];
  can_reply: boolean;
  staff: boolean;
  useful: number;
  reply_to: { code: string; name: string } | null;
  post: { slug: string; title: string; href: string };
  created_at: string;
  moderated_at: string | null;
  moderator: string | null;
}

export interface CommentsOverview {
  items: ConsoleComment[];
  counts: Record<CommentStatus | "total" | "replies", number>;
  statuses: Choice[];
}

export interface ConsolePopup {
  id: string;
  code: string;
  name: string;
  trigger: PopupTrigger;
  trigger_label: string;
  kind: PopupKind;
  kind_label: string;
  pages: PopupPage[];
  page_labels: string[];
  freq_days: number;
  eyebrow: string | null;
  title: string;
  body: string;
  cta_label: string;
  cta_href: string | null;
  status: "borrador" | "activo" | "pausado";
  status_label: string;
  next: Choice[];
  views: number;
  conversions: number;
  conversion_pct: number | null;
  updated_at: string;
}

export interface PopupsOverview {
  items: ConsolePopup[];
  counts: { total: number; borrador: number; activo: number; pausado: number; views: number; conversions: number };
  options: { triggers: Choice[]; kinds: Choice[]; pages: Choice[]; statuses: Choice[] };
}

export interface Subscriber {
  id: string;
  email: string;
  source: string;
  source_label: string;
  status: "pendiente" | "confirmado" | "baja";
  status_label: string;
  created_at: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
}

export interface SubscribersOverview {
  items: Subscriber[];
  counts: { total: number; pendiente: number; confirmado: number; baja: number };
  sources: (Choice & { confirmed: number })[];
}

export interface ConsolePost {
  id: string;
  slug: string;
  title: string;
  title_accent: string | null;
  excerpt: string;
  body: string | null;
  category: string | null;
  category_label: string | null;
  focus_keyword: string;
  author_name: string | null;
  author_role: string | null;
  featured: boolean;
  allow_comments: boolean;
  faq: BlogFaq[];
  status: "borrador" | "publicado" | "archivado";
  status_label: string;
  next: Choice[];
  word_count: number;
  reads: number;
  useful_yes: number;
  useful_no: number;
  comments: { approved: number; pending: number };
  published_at: string | null;
  updated_at: string;
  href: string;
  deletable: boolean;
}

export interface PostsOverview {
  items: ConsolePost[];
  counts: { total: number; borrador: number; publicado: number; archivado: number; reads: number };
  categories: Choice[];
  rules: { min_words: number };
}

export function faqFromText(text: string): BlogFaq[] {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const [question = "", ...answer] = block.split("\n");
      return { q: question.replace(/^P:\s*/i, "").trim(), a: answer.join(" ").replace(/^R:\s*/i, "").trim() };
    })
    .filter((item) => item.q !== "" && item.a !== "");
}

export function faqToText(faq: BlogFaq[]): string {
  return faq.map((item) => `${item.q}\n${item.a}`).join("\n\n");
}
