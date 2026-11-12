jest.mock("expo-sqlite", () => ({ openDatabaseAsync: jest.fn() }));
jest.mock("expo-crypto", () => ({ getRandomValues: (bytes: Uint8Array) => bytes, digest: jest.fn(), CryptoDigestAlgorithm: { SHA256: "SHA-256" } }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("expo-file-system", () => ({ File: jest.fn() }));
jest.mock("expo-image-manipulator", () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: "jpeg" } }));
jest.mock("expo-image-picker", () => ({ requestCameraPermissionsAsync: jest.fn(), launchCameraAsync: jest.fn() }));

import { withUpload } from "../src/data/evidence";

describe("fotos de la incidencia", () => {
  it("agrega la foto subida a la incidencia pendiente sin repetirla", () => {
    const payload = JSON.stringify({ type: "Transporte", severity: "alta", title: "Bus averiado", upload_ids: [] });
    const once = withUpload(payload, "u-1");
    const twice = withUpload(withUpload(once, "u-2"), "u-1");
    expect(JSON.parse(twice)).toMatchObject({ title: "Bus averiado", upload_ids: ["u-1", "u-2"] });
  });
});
