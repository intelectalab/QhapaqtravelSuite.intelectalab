export const LOAD_FAILED = "No pudimos cargar esta información. Vuelve a intentarlo en un momento.";

export async function withRetry<T>(run: () => Promise<T>, attempts = 2): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= attempts) throw error;
    }
  }
}
