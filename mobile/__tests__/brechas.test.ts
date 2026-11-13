jest.mock("expo-sqlite", () => ({ openDatabaseAsync: jest.fn() }));
jest.mock("@react-native-community/netinfo", () => ({ addEventListener: jest.fn(() => jest.fn()), fetch: jest.fn(async () => ({ isConnected: true })) }));
jest.mock("expo-crypto", () => ({ getRandomValues: (bytes: Uint8Array) => bytes, digest: jest.fn(), CryptoDigestAlgorithm: { SHA256: "SHA-256" } }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("expo-file-system", () => ({ File: jest.fn() }));
jest.mock("expo-image-manipulator", () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: "jpeg" } }));
jest.mock("expo-image-picker", () => ({ requestCameraPermissionsAsync: jest.fn(), launchCameraAsync: jest.fn() }));

import { MAX_UPLOAD_ATTEMPTS, nextUploadState } from "../src/data/evidence";
import { countdownLabel } from "../src/format";
import { isDeviceRevoked } from "../src/offline/sync";

describe("fotos con error (spec 05 §4.8)", () => {
  it("deja la foto pendiente hasta agotar los intentos y luego la marca con error", () => {
    expect(nextUploadState(1)).toBe("pending");
    expect(nextUploadState(MAX_UPLOAD_ATTEMPTS - 1)).toBe("pending");
    expect(nextUploadState(MAX_UPLOAD_ATTEMPTS)).toBe("failed");
  });
});

describe("dispositivo desactivado (MOB-BR-01)", () => {
  it("solo borra los datos cuando la agencia desactivó el teléfono", () => {
    expect(isDeviceRevoked(403, "DEVICE_REVOKED")).toBe(true);
    expect(isDeviceRevoked(403, "MOB-BR-01")).toBe(false);
    expect(isDeviceRevoked(401, "DEVICE_REVOKED")).toBe(false);
  });
});

describe("cuenta regresiva de la próxima actividad", () => {
  const now = new Date("2026-11-12T10:00:00Z");

  it("muestra minutos, horas o días según lo que falte", () => {
    expect(countdownLabel("2026-11-12T10:40:00Z", now)).toBe("en 40 min");
    expect(countdownLabel("2026-11-12T13:15:00Z", now)).toBe("en 3 h 15 min");
    expect(countdownLabel("2026-11-14T12:00:00Z", now)).toBe("en 2 d 2 h");
    expect(countdownLabel("2026-11-12T09:00:00Z", now)).toBe("en un momento");
  });
});
