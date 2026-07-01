import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { hashImageDataUrl } from "./image.js";

export interface VisionCacheOptions {
  enabled: boolean;
  cacheDir: string;
}

export interface CacheKeyInput {
  imageDataUrl?: string;
  imageDataUrls?: string[];
  tool: string;
  task?: string;
  model: string;
  promptVersion: string;
  options: Record<string, unknown>;
}

export interface CacheRecord {
  created_at?: string;
  provider: string;
  model: string;
  tool: string;
  inputHash: string;
  result: unknown;
}

export class VisionCache {
  constructor(private readonly options: VisionCacheOptions) {}

  async createKey(input: CacheKeyInput): Promise<string> {
    const inputHash = hashImageSet(input.imageDataUrls ?? (input.imageDataUrl ? [input.imageDataUrl] : []));
    const normalized = JSON.stringify({
      inputHash,
      tool: input.tool,
      task: input.task ?? "",
      model: input.model,
      promptVersion: input.promptVersion,
      options: input.options
    });

    return createHash("sha256").update(normalized).digest("hex");
  }

  async read(key: string): Promise<CacheRecord | null> {
    if (!this.options.enabled) return null;

    try {
      const raw = await readFile(this.filePath(key), "utf8");
      return JSON.parse(raw) as CacheRecord;
    } catch {
      return null;
    }
  }

  async write(key: string, record: Omit<CacheRecord, "created_at">): Promise<void> {
    if (!this.options.enabled) return;

    await mkdir(this.options.cacheDir, { recursive: true });
    await writeFile(
      this.filePath(key),
      JSON.stringify({ created_at: new Date().toISOString(), ...record }, null, 2),
      "utf8"
    );
  }

  private filePath(key: string): string {
    return join(this.options.cacheDir, `${key}.json`);
  }
}

function hashImageSet(imageDataUrls: string[]): string {
  const hashes = imageDataUrls.map((imageDataUrl) => hashImageDataUrl(imageDataUrl));
  return hashes.join(":");
}
