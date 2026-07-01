import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { logger } from "./logger.js";

const INDEX_FILE = "index.json";

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif"
};

export interface UploadMeta {
  file_id: string;
  mime_type: string;
  size: number;
  created_at: string;
  original_name?: string;
}

export interface IndexData {
  version: number;
  files: Record<string, UploadMeta>;
}

/**
 * Disk-backed, content-deduplicated upload store.
 *
 * file_id = sha256(content).getBytes().hex (first 40 chars) -- same content
 * always maps to the same file_id, so uploading the same image twice returns
 * the existing file_id without rewriting bytes.
 *
 * Layout:
 *   {uploadsDir}/{file_id}.{ext}   <- raw image bytes
 *   {uploadsDir}/index.json         <- metadata index (file_id -> meta)
 *
 * On startup, loadIndex() reconciles the index with files on disk so file_ids
 * survive process restarts. Tools resolve file_id -> buffer via read().
 */
export class UploadStore {
  private readonly dir: string;
  private index: IndexData = { version: 1, files: {} };

  constructor(dir: string) {
    this.dir = dir;
  }

  async init(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await this.loadIndex();
  }

  private async loadIndex(): Promise<void> {
    const indexPath = join(this.dir, INDEX_FILE);
    try {
      const raw = await readFile(indexPath, "utf8");
      this.index = JSON.parse(raw) as IndexData;
    } catch {
      // No index yet (first run, or corrupted). Rebuild from disk.
      this.index = { version: 1, files: {} };
      await this.rebuildIndexFromDisk();
      return;
    }
    // Reconcile: drop index entries whose file is gone, adopt orphan files.
    await this.reconcileIndex();
  }

  private async rebuildIndexFromDisk(): Promise<void> {
    const entries = await readdir(this.dir).catch(() => []);
    for (const name of entries) {
      if (name === INDEX_FILE) continue;
      const dot = name.lastIndexOf(".");
      if (dot <= 0) continue;
      const fileId = name.slice(0, dot);
      if (this.index.files[fileId]) continue;
      const fullPath = join(this.dir, name);
      try {
        const s = await stat(fullPath);
        const ext = name.slice(dot + 1);
        const mimeType = extToMime(ext);
        if (mimeType) {
          this.index.files[fileId] = {
            file_id: fileId,
            mime_type: mimeType,
            size: s.size,
            created_at: s.mtime.toISOString()
          };
        }
      } catch {
        // skip unreadable
      }
    }
    await this.saveIndex();
  }

  private async reconcileIndex(): Promise<void> {
    let changed = false;
    // Remove index entries whose file disappeared.
    for (const fileId of Object.keys(this.index.files)) {
      const meta = this.index.files[fileId];
      const path = this.filePath(fileId, meta.mime_type);
      if (!existsSync(path)) {
        delete this.index.files[fileId];
        changed = true;
      }
    }
    // Adopt orphan files not in index.
    const entries = await readdir(this.dir).catch(() => []);
    for (const name of entries) {
      if (name === INDEX_FILE) continue;
      const dot = name.lastIndexOf(".");
      if (dot <= 0) continue;
      const fileId = name.slice(0, dot);
      if (this.index.files[fileId]) continue;
      const ext = name.slice(dot + 1);
      const mimeType = extToMime(ext);
      if (!mimeType) continue;
      try {
        const s = await stat(join(this.dir, name));
        this.index.files[fileId] = {
          file_id: fileId,
          mime_type: mimeType,
          size: s.size,
          created_at: s.mtime.toISOString()
        };
        changed = true;
      } catch {
        // skip
      }
    }
    if (changed) await this.saveIndex();
  }

  /**
   * Stage uploaded bytes. Dedupes by content hash: if the file already exists,
   * returns the existing file_id without rewriting. Returns the meta plus a
   * dedup flag (true = content was already on disk, no bytes written).
   */
  async stage(buffer: Buffer, mimeType: string, originalName?: string): Promise<{ meta: UploadMeta; dedup: boolean }> {
    const fileId = this.computeFileId(buffer);
    const existing = this.index.files[fileId];
    const path = this.filePath(fileId, mimeType);

    if (existing && existsSync(path)) {
      // Dedup hit: same content already on disk.
      if (originalName && !existing.original_name) {
        existing.original_name = originalName;
        await this.saveIndex();
      }
      return { meta: existing, dedup: true };
    }

    // New (or orphaned index entry without file): write bytes + index.
    await mkdir(this.dir, { recursive: true });
    await writeFile(path, buffer);
    const meta: UploadMeta = {
      file_id: fileId,
      mime_type: mimeType,
      size: buffer.length,
      created_at: new Date().toISOString(),
      original_name: originalName
    };
    this.index.files[fileId] = meta;
    await this.saveIndex();
    return { meta, dedup: false };
  }

  /** Read bytes for a file_id. Returns null if unknown/missing. */
  async read(fileId: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const meta = this.index.files[fileId];
    if (!meta) return null;
    const path = this.filePath(fileId, meta.mime_type);
    try {
      const buffer = await readFile(path);
      return { buffer, mimeType: meta.mime_type };
    } catch {
      return null;
    }
  }

  getMeta(fileId: string): UploadMeta | null {
    return this.index.files[fileId] ?? null;
  }

  list(): UploadMeta[] {
    return Object.values(this.index.files);
  }

  private computeFileId(buffer: Buffer): string {
    return createHash("sha256").update(buffer).digest("hex").slice(0, 40);
  }

  private filePath(fileId: string, mimeType: string): string {
    const ext = MIME_TO_EXT[mimeType] ?? "bin";
    return join(this.dir, `${fileId}.${ext}`);
  }

  private async saveIndex(): Promise<void> {
    const indexPath = join(this.dir, INDEX_FILE);
    await writeFile(indexPath, JSON.stringify(this.index, null, 2), "utf8");
  }
}

function extToMime(ext: string): string | null {
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif"
  };
  return map[ext.toLowerCase()] ?? null;
}
