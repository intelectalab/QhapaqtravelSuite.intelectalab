import { describe, expect, it, vi } from "vitest";
import { withRetry } from "./retry";

describe("withRetry", () => {
  it("devuelve el resultado al primer intento", async () => {
    const run = vi.fn().mockResolvedValue("ok");
    await expect(withRetry(run)).resolves.toBe("ok");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("reintenta una vez si el primer intento falla", async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error("abortado")).mockResolvedValue("ok");
    await expect(withRetry(run)).resolves.toBe("ok");
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("propaga el error cuando se agotan los intentos", async () => {
    const run = vi.fn().mockRejectedValue(new Error("caído"));
    await expect(withRetry(run)).rejects.toThrow("caído");
    expect(run).toHaveBeenCalledTimes(2);
  });
});
