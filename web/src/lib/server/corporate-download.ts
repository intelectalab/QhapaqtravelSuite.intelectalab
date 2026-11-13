import "server-only";
import { downloadError } from "./download";
import { sessionToken } from "./session";

const API_URL = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export async function proxyFile(path: string): Promise<Response> {
  const token = await sessionToken();
  if (!token) return downloadError("Tu sesión venció. Vuelve a ingresar para descargar el archivo.", 401);

  const upstream = await fetch(`${API_URL}${path}`, { headers: { Accept: "*/*", Authorization: `Bearer ${token}` }, cache: "no-store" }).catch(() => null);
  if (upstream === null) return downloadError("No pudimos conectar con el servidor. Inténtalo de nuevo en unos segundos.", 502);

  const type = upstream.headers.get("content-type") ?? "";
  if (upstream.ok && upstream.body && !type.startsWith("application/json")) {
    const headers = new Headers({ "Content-Type": type, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
    for (const name of ["content-length", "content-disposition"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(upstream.body, { status: 200, headers });
  }

  const payload = await upstream.json().catch(() => null);
  return downloadError(payload?.message ?? "No pudimos descargar el archivo.", upstream.ok ? 502 : upstream.status);
}
