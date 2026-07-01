import { UploadStore } from "./upload-store.js";
import type { OcularConfig } from "../config.js";

let instance: UploadStore | null = null;

export const UPLOAD_PATH = "/upload";

export function initUploadStore(config: OcularConfig): UploadStore {
  instance = new UploadStore(config.uploadsDir);
  return instance;
}

export function getUploadStore(): UploadStore {
  if (!instance) {
    throw new Error("UploadStore not initialized. Call initUploadStore() at startup.");
  }
  return instance;
}

export function getPublicUploadUrl(config: OcularConfig): string {
  return config.publicUploadUrl;
}
