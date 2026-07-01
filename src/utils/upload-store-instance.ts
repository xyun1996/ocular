import { UploadStore } from "./upload-store.js";
import type { VisionBridgeConfig } from "../config.js";

let instance: UploadStore | null = null;

export const UPLOAD_PATH = "/upload";

export function initUploadStore(config: VisionBridgeConfig): UploadStore {
  instance = new UploadStore(config.uploadsDir);
  return instance;
}

export function getUploadStore(): UploadStore {
  if (!instance) {
    throw new Error("UploadStore not initialized. Call initUploadStore() at startup.");
  }
  return instance;
}

export function getPublicUploadUrl(config: VisionBridgeConfig): string {
  return config.publicUploadUrl;
}
