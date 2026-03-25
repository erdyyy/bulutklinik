/**
 * Klinik Analiz Oturumu Depolama — IndexedDB
 *
 * Her tam analiz (fotoğraf + AI rapor) otomatik kaydedilir.
 * Doktor geçmiş seansları listeleyip yükleyebilir.
 */

import type { AsymmetryResult, TreatmentPlanResponse } from "./asymmetryApi";

// ─── Types ────────────────────────────────────────────────────────────────── //

export interface AnalysisSession {
  id:          string;   // crypto.randomUUID()
  createdAt:   number;   // Date.now()
  label:       string;   // Kullanıcı tarafından düzenlenebilir ("Seans 1")
  patientId:   number;

  // Kart önizleme için özet
  symmetryScore:      number;
  thumbnailB64:       string;   // 80×80 JPEG data URL
  eyebrowDeltaMm:     number;
  lipDeltaMm:         number;
  midlineDeviationMm: number;

  // Tam yüklenebilir veri
  result:            AsymmetryResult;
  plan:              TreatmentPlanResponse | null;
  beforePreviewB64:  string;         // max 600px, JPEG data URL
  profilePreviewB64: string | null;
}

// ─── IndexedDB ────────────────────────────────────────────────────────────── //

const DB_NAME = "bulutklinik_v1";
const STORE   = "sessions";
const DB_VER  = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () =>
      req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

export async function sessionSave(s: AnalysisSession): Promise<void> {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(s);
    tx.oncomplete = () => res();
    tx.onerror    = () => rej(tx.error);
  });
}

export async function sessionsForPatient(patientId: number): Promise<AnalysisSession[]> {
  const db = await openDB();
  return new Promise((res, rej) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    req.onsuccess = () =>
      res(
        (req.result as AnalysisSession[])
          .filter(s => s.patientId === patientId)
          .sort((a, b) => b.createdAt - a.createdAt)
      );
    req.onerror = () => rej(req.error);
  });
}

/** Tüm hastalara ait oturumları döner (dashboard istatistikleri için). */
export async function sessionsAll(): Promise<AnalysisSession[]> {
  const db = await openDB();
  return new Promise((res, rej) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    req.onsuccess = () =>
      res((req.result as AnalysisSession[]).sort((a, b) => b.createdAt - a.createdAt));
    req.onerror = () => rej(req.error);
  });
}

export async function sessionDelete(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => res();
    tx.onerror    = () => rej(tx.error);
  });
}

export async function sessionUpdateLabel(id: string, label: string): Promise<void> {
  const db = await openDB();
  return new Promise((res, rej) => {
    const store  = db.transaction(STORE, "readwrite").objectStore(STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const s = getReq.result as AnalysisSession;
      if (s) { s.label = label; store.put(s); }
      res();
    };
    getReq.onerror = () => rej(getReq.error);
  });
}

// ─── Canvas Yardımcıları ──────────────────────────────────────────────────── //

/**
 * Herhangi bir resim kaynağından (blob URL veya data URL)
 * kare kırpılmış küçük thumbnail üretir.
 */
export function createThumbnail(src: string, size = 80): Promise<string> {
  return new Promise(resolve => {
    if (!src) { resolve(""); return; }
    const img = new Image();
    img.onload = () => {
      const c   = document.createElement("canvas");
      c.width   = c.height = size;
      const ctx = c.getContext("2d")!;
      const min = Math.min(img.width, img.height);
      const sx  = (img.width  - min) / 2;
      const sy  = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      resolve(c.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = () => resolve("");
    img.src     = src;
  });
}

/**
 * Blob URL'yi kalıcı depolanabilir base64 data URL'ye dönüştürür.
 * (Blob URL'ler sayfa yenilenince geçersiz olur.)
 */
export function blobUrlToDataUrl(blobUrl: string, maxPx = 640): Promise<string> {
  return new Promise(resolve => {
    if (!blobUrl) { resolve(""); return; }
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1);
      const w = Math.round(img.width  * ratio);
      const h = Math.round(img.height * ratio);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d")!.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => resolve("");
    img.src     = blobUrl;
  });
}
