"use client";

import { openDB, type IDBPDatabase } from "idb";
import { clientStorageDriver, uploadToBlob } from "@/lib/media/client-upload";
import { SERVER_UPLOAD_MAX_BYTES } from "@/lib/media/server";

/**
 * The offline-first submission queue. Everything a player submits is
 * written HERE first (IndexedDB), shown as "saved" immediately, and synced
 * to the server in the background with retry. The user is never blocked by
 * the network — this is the single most important mechanism in the app.
 *
 * Phase 2 carries quiz answers; text (Phase 3) and media (Phase 4) flow
 * through the same queue and the same retry policy.
 */

export type OutboxKind = "quiz" | "text" | "media";

export type OutboxStatus =
  | "queued" // waiting for a sync attempt
  | "inflight" // request currently running
  | "done" // server acknowledged
  | "rejected"; // server said no (4xx) — retrying won't help

export interface OutboxItem {
  clientUuid: string;
  kind: OutboxKind;
  questId: string;
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  status: OutboxStatus;
  lastError?: string;
  /** Server ack body (e.g. quiz reveal data), kept for the UI. */
  response?: unknown;
  /** Media only: the (already downscaled/validated) bytes to upload. */
  blob?: Blob;
  blobContentType?: string;
  /**
   * Media only: set once the blob upload succeeds — a checkpoint, so a
   * reload between blob upload and metadata POST never re-sends bytes.
   */
  blobUrl?: string;
  /** Media only: upload progress 0–100 (memory only, not persisted). */
  progress?: number;
}

export interface OutboxSnapshot {
  items: OutboxItem[];
  /** queued + inflight */
  pending: number;
  rejected: number;
}

const ENDPOINT_BY_KIND: Record<OutboxKind, string> = {
  quiz: "/api/answers",
  text: "/api/submissions",
  media: "/api/submissions",
};

/** PUT a blob with upload progress (fetch can't report upload progress). */
function xhrPut(
  url: string,
  blob: Blob,
  contentType: string,
  onProgress: (pct: number) => void,
  signal?: AbortSignal,
): Promise<{ url: string }> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as { url: string });
        } catch {
          reject(new Error("Upload response was not JSON"));
        }
      } else {
        // Surface the server's error message (e.g. the Blob write reason)
        // instead of a bare status code.
        let message = `Upload failed (${xhr.status})`;
        try {
          const body = JSON.parse(xhr.responseText) as { error?: string };
          if (body?.error) message = body.error;
        } catch {
          /* non-JSON body — keep the status message */
        }
        const err = new Error(message);
        (err as Error & { status?: number }).status = xhr.status;
        reject(err);
      }
    };
    xhr.onerror = () => reject(new Error("Upload network error"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.send(blob);
  });
}

const DB_NAME = "wedding-game";
const STORE = "outbox";
const DONE_TTL_MS = 24 * 60 * 60 * 1000;
/** Abort a send if the upload/POST makes no progress for this long. Stops one
 *  stalled upload from deadlocking the whole (serialized) queue. */
const STALL_TIMEOUT_MS = 45_000;

const EMPTY_SNAPSHOT: OutboxSnapshot = { items: [], pending: 0, rejected: 0 };

function backoffMs(attempts: number): number {
  return (
    Math.min(30_000, 1000 * 2 ** Math.min(attempts, 5)) *
    (0.5 + Math.random())
  );
}

class Outbox {
  private dbPromise: Promise<IDBPDatabase> | null = null;
  private items = new Map<string, OutboxItem>();
  /** In-flight aborts, keyed by clientUuid (stall watchdog + user cancel). */
  private controllers = new Map<string, AbortController>();
  private listeners = new Set<() => void>();
  private snapshot: OutboxSnapshot = EMPTY_SNAPSHOT;
  private initialized = false;
  private flushing = false;
  private flushAgain = false;

  private db(): Promise<IDBPDatabase> {
    this.dbPromise ??= openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE, { keyPath: "clientUuid" });
      },
    });
    return this.dbPromise;
  }

  /** Load persisted items; recover crashed 'inflight' items; prune old. */
  async init(): Promise<void> {
    if (this.initialized || typeof window === "undefined") return;
    this.initialized = true;

    const db = await this.db();
    const all = (await db.getAll(STORE)) as OutboxItem[];
    const cutoff = Date.now() - DONE_TTL_MS;
    for (const item of all) {
      if (item.status === "done" && item.createdAt < cutoff) {
        await db.delete(STORE, item.clientUuid);
        continue;
      }
      if (item.status === "inflight") {
        // We crashed or were killed mid-request. The server may or may not
        // have it — clientUuid idempotency makes the retry safe.
        item.status = "queued";
        item.nextAttemptAt = 0;
        await db.put(STORE, item);
      }
      this.items.set(item.clientUuid, item);
    }
    this.notify();
    void this.flush();
  }

  async enqueue(
    input: Pick<OutboxItem, "kind" | "questId" | "payload"> &
      Partial<Pick<OutboxItem, "blob" | "blobContentType">>,
  ): Promise<OutboxItem> {
    const item: OutboxItem = {
      ...input,
      clientUuid: crypto.randomUUID(),
      createdAt: Date.now(),
      attempts: 0,
      nextAttemptAt: 0,
      status: "queued",
    };
    // IndexedDB first — the submission survives anything from here on.
    await (await this.db()).put(STORE, item);
    this.items.set(item.clientUuid, item);
    this.notify();
    void this.flush();
    return item;
  }

  /**
   * Abandon a submission: abort any in-flight upload and delete it from the
   * queue. The escape hatch behind the "Cancel" button so a stuck upload never
   * traps the player on a quest. Deleting from `items` first means the send()
   * catch sees the item is gone and won't re-queue it.
   */
  async cancel(clientUuid: string): Promise<void> {
    const controller = this.controllers.get(clientUuid);
    this.controllers.delete(clientUuid);
    this.items.delete(clientUuid);
    controller?.abort();
    this.notify();
    await (await this.db()).delete(STORE, clientUuid);
  }

  /** Clear backoff delays (e.g. the 'online' event) and sync now. */
  retryNow(): void {
    for (const item of this.items.values()) {
      if (item.status === "queued") item.nextAttemptAt = 0;
    }
    void this.flush();
  }

  /**
   * Sync eligible items, oldest first, one at a time (gentle on bad wifi).
   * Serialized per tab; the Web Lock serializes across tabs where
   * supported so two tabs can't double-send.
   */
  async flush(): Promise<void> {
    if (typeof window === "undefined" || !this.initialized) return;
    if (this.flushing) {
      this.flushAgain = true;
      return;
    }
    this.flushing = true;
    try {
      if (navigator.locks?.request) {
        await navigator.locks.request(
          "outbox-flush",
          { ifAvailable: true },
          async (lock) => {
            if (lock) await this.drain();
          },
        );
      } else {
        await this.drain();
      }
    } finally {
      this.flushing = false;
      if (this.flushAgain) {
        this.flushAgain = false;
        void this.flush();
      }
    }
  }

  private async drain(): Promise<void> {
    for (;;) {
      const now = Date.now();
      const next = [...this.items.values()]
        .filter((i) => i.status === "queued" && i.nextAttemptAt <= now)
        .sort((a, b) => a.createdAt - b.createdAt)[0];
      if (!next) return;
      await this.send(next);
    }
  }

  private async send(item: OutboxItem): Promise<void> {
    await this.update(item, { status: "inflight" });

    // Stall watchdog: abort if nothing moves for STALL_TIMEOUT_MS. Re-armed on
    // every progress tick and before the metadata POST, so a legitimately slow
    // (but progressing) upload is never killed — only a genuine stall.
    const controller = new AbortController();
    this.controllers.set(item.clientUuid, controller);
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      if (watchdog) clearTimeout(watchdog);
      watchdog = setTimeout(() => controller.abort(), STALL_TIMEOUT_MS);
    };
    arm();

    try {
      // Media step A: upload the bytes (direct PUT with progress), then
      // checkpoint the resulting URL so retries skip straight to step B.
      let current = this.items.get(item.clientUuid) ?? item;
      if (current.kind === "media" && !current.blobUrl && current.blob) {
        const onProgress = (pct: number) => {
          this.progress(current.clientUuid, pct);
          arm();
        };
        // Small media (photos, avatars) go through OUR origin — reliable on
        // cellular, where a direct browser → Blob upload gets rejected. Only
        // large videos, which can't fit a serverless request body, go straight
        // to Blob (and realistically want wifi).
        const directToBlob =
          clientStorageDriver() === "vercel-blob" &&
          current.blob.size > SERVER_UPLOAD_MAX_BYTES;
        if (directToBlob) {
          // Bytes go browser → Vercel Blob directly (multipart), then we
          // checkpoint the public URL so retries skip straight to step B.
          const { url } = await uploadToBlob({
            clientUuid: current.clientUuid,
            blob: current.blob,
            contentType: current.blobContentType ?? "application/octet-stream",
            onProgress,
            abortSignal: controller.signal,
          });
          await this.update(current, { blobUrl: url });
        } else {
          // Get a PUT target from our own endpoint, then PUT the bytes there;
          // the server stores them to Blob (prod) or disk (dev).
          const target = await fetch("/api/media/upload-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              clientUuid: current.clientUuid,
              contentType: current.blobContentType,
            }),
            signal: controller.signal,
          });
          if (!target.ok) {
            const body = await target.json().catch(() => null);
            if (target.status >= 400 && target.status < 500) {
              await this.update(current, {
                status: "rejected",
                lastError:
                  (body as { error?: string } | null)?.error ??
                  `Rejected (${target.status})`,
              });
              return;
            }
            throw new Error(`upload-url failed (${target.status})`);
          }
          const { url } = (await target.json()) as { url: string };
          const uploaded = await xhrPut(
            url,
            current.blob,
            current.blobContentType ?? "application/octet-stream",
            onProgress,
            controller.signal,
          );
          await this.update(current, { blobUrl: uploaded.url });
        }
        current = this.items.get(item.clientUuid) ?? current;
      }

      arm(); // fresh window for the metadata POST
      const res = await fetch(ENDPOINT_BY_KIND[current.kind], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientUuid: current.clientUuid,
          questId: current.questId,
          ...current.payload,
          ...(current.kind === "media" ? { mediaUrl: current.blobUrl } : {}),
        }),
        signal: controller.signal,
      });

      if (res.ok) {
        const response = await res.json().catch(() => null);
        // Bytes are safely server-side now — drop the blob to free quota.
        await this.update(this.latest(item), {
          status: "done",
          response,
          blob: undefined,
          progress: undefined,
        });
        return;
      }

      if (res.status >= 400 && res.status < 500) {
        // The server understood and said no (frozen, blocked, invalid…).
        // Retrying an identical request won't change its mind.
        const body = await res.json().catch(() => null);
        const message =
          (body as { error?: string } | null)?.error ??
          `Rejected (${res.status})`;
        await this.update(this.latest(item), {
          status: "rejected",
          lastError: message,
        });
        return;
      }

      throw new Error(`Server error (${res.status})`);
    } catch (err) {
      // Cancelled by the user: the item was already removed — don't resurrect
      // it by writing a queued row back.
      if (!this.items.has(item.clientUuid)) return;
      // Network failure, 5xx, or a stall abort: schedule a retry. Never give up
      // while the app is open. (this.latest keeps the blobUrl checkpoint, so a
      // retry after the byte upload skips straight to the metadata POST.)
      const fresh = this.latest(item);
      await this.update(fresh, {
        status: "queued",
        attempts: fresh.attempts + 1,
        nextAttemptAt: Date.now() + backoffMs(fresh.attempts + 1),
        lastError: err instanceof Error ? err.message : "network error",
        progress: undefined,
      });
    } finally {
      if (watchdog) clearTimeout(watchdog);
      this.controllers.delete(item.clientUuid);
    }
  }

  /** Freshest version of an item (update() replaces map entries). */
  private latest(item: OutboxItem): OutboxItem {
    return this.items.get(item.clientUuid) ?? item;
  }

  /** Memory-only progress update — too chatty to persist per tick. */
  private progress(clientUuid: string, pct: number): void {
    const item = this.items.get(clientUuid);
    if (!item) return;
    this.items.set(clientUuid, { ...item, progress: pct });
    this.notify();
  }

  private async update(
    item: OutboxItem,
    patch: Partial<OutboxItem>,
  ): Promise<void> {
    const updated = { ...item, ...patch };
    this.items.set(updated.clientUuid, updated);
    await (await this.db()).put(STORE, updated);
    this.notify();
  }

  // --- subscription API (shaped for useSyncExternalStore) ---

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  getSnapshot = (): OutboxSnapshot => this.snapshot;

  getServerSnapshot = (): OutboxSnapshot => EMPTY_SNAPSHOT;

  private notify(): void {
    const items = [...this.items.values()].sort(
      (a, b) => b.createdAt - a.createdAt,
    );
    this.snapshot = {
      items,
      pending: items.filter(
        (i) => i.status === "queued" || i.status === "inflight",
      ).length,
      rejected: items.filter((i) => i.status === "rejected").length,
    };
    for (const cb of this.listeners) cb();
  }
}

/** Module-scope singleton; import only from client components. */
export const outbox = new Outbox();
