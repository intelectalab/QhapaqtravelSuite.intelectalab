import { appHeaders, isUpgradeRequired, onUpgradeRequired, reportUpgrade, upgradeFrom } from "../src/api/upgrade";
import { APP_VERSION } from "../src/config";

describe("versión mínima de la app (G3-27)", () => {
  it("envía la versión y la plataforma en cada pedido", () => {
    const headers = appHeaders();
    expect(headers["X-App-Version"]).toBe(APP_VERSION);
    expect(["ios", "android"]).toContain(headers["X-App-Platform"]);
  });

  it("solo el 426 pide actualizar", () => {
    expect(isUpgradeRequired(426)).toBe(true);
    expect(isUpgradeRequired(403)).toBe(false);
    expect(isUpgradeRequired(200)).toBe(false);
  });

  it("toma el mensaje, la versión mínima y el enlace de la respuesta", () => {
    expect(upgradeFrom({ message: "Actualiza", details: { min_version: "1.2.0", store_url: "https://play.google.com/x" } })).toEqual({ message: "Actualiza", minVersion: "1.2.0", storeUrl: "https://play.google.com/x" });
    expect(upgradeFrom({}).storeUrl).toBeNull();
  });

  it("avisa a quien escucha y deja de avisar al desuscribirse", () => {
    const listener = jest.fn();
    const off = onUpgradeRequired(listener);
    reportUpgrade({ message: "Actualiza", minVersion: "1.2.0", storeUrl: null });
    off();
    reportUpgrade({ message: "Otra", minVersion: null, storeUrl: null });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
