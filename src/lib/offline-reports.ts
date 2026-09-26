import { supabase } from "@/integrations/supabase/client";
import { uploadReportMedia } from "@/lib/reports";

const DB_NAME = "eco-bridge-offline";
const DB_VERSION = 1;
const REPORT_STORE = "reports";
const MEDIA_STORE = "media";

export type OfflineSyncState = "pending" | "syncing" | "sent" | "needs_attention";

export interface OfflineReportPayload {
  reporter_name: string | null;
  title: string;
  description: string;
  category_key: string;
  district: string;
  area_type: "urban" | "rural";
  block: string | null;
  municipality: string | null;
  village_or_ward: string | null;
  location_text: string;
  latitude: number | null;
  longitude: number | null;
  location_accuracy_meters: number | null;
  location_captured_at: string | null;
  priority: string;
  ai_category: string | null;
  ai_priority: string | null;
  ai_duplicate_count: number;
  ai_recommended_department: string | null;
  ai_next_action: string | null;
  language: string;
}

export interface OfflineReportRecord {
  offlineLocalId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  syncState: OfflineSyncState;
  retryCount: number;
  error: string | null;
  payload: OfflineReportPayload;
  mediaCount: number;
  cloudReportId: string | null;
  publicIssueId: string | null;
}

interface OfflineMediaRecord {
  mediaId: string;
  offlineLocalId: string;
  userId: string;
  name: string;
  type: string;
  size: number;
  blob: Blob;
  kind: "image" | "video";
}

function createId() {
  return crypto.randomUUID();
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("Could not open offline storage."));
    request.onupgradeneeded = () => {
      const db = request.result;
      const reports = db.createObjectStore(REPORT_STORE, { keyPath: "offlineLocalId" });
      reports.createIndex("userId", "userId", { unique: false });
      reports.createIndex("syncState", "syncState", { unique: false });
      const media = db.createObjectStore(MEDIA_STORE, { keyPath: "mediaId" });
      media.createIndex("offlineLocalId", "offlineLocalId", { unique: false });
      media.createIndex("userId", "userId", { unique: false });
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Offline storage request failed."));
  });
}

export async function saveOfflineReport(args: {
  userId: string;
  payload: OfflineReportPayload;
  images: File[];
  video: File | null;
}): Promise<OfflineReportRecord> {
  const db = await openDatabase();
  const offlineLocalId = createId();
  const now = new Date().toISOString();
  const mediaFiles = [...args.images, ...(args.video ? [args.video] : [])];
  const record: OfflineReportRecord = {
    offlineLocalId,
    userId: args.userId,
    createdAt: now,
    updatedAt: now,
    syncState: "pending",
    retryCount: 0,
    error: null,
    payload: args.payload,
    mediaCount: mediaFiles.length,
    cloudReportId: null,
    publicIssueId: null,
  };

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([REPORT_STORE, MEDIA_STORE], "readwrite");
    transaction.objectStore(REPORT_STORE).put(record);
    mediaFiles.forEach((file) => {
      transaction.objectStore(MEDIA_STORE).put({
        mediaId: createId(),
        offlineLocalId,
        userId: args.userId,
        name: file.name,
        type: file.type,
        size: file.size,
        blob: file,
        kind: file.type.startsWith("video/") ? "video" : "image",
      } satisfies OfflineMediaRecord);
    });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save offline report."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Could not save offline report."));
  });
  db.close();
  return record;
}

export async function listOfflineReports(userId: string): Promise<OfflineReportRecord[]> {
  const db = await openDatabase();
  const records = await requestResult<OfflineReportRecord[]>(
    db.transaction(REPORT_STORE, "readonly").objectStore(REPORT_STORE).index("userId").getAll(userId),
  );
  db.close();
  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getOfflineReport(offlineLocalId: string): Promise<OfflineReportRecord | null> {
  const db = await openDatabase();
  const record = await requestResult<OfflineReportRecord | undefined>(
    db.transaction(REPORT_STORE, "readonly").objectStore(REPORT_STORE).get(offlineLocalId),
  );
  db.close();
  return record ?? null;
}

async function getMedia(offlineLocalId: string) {
  const db = await openDatabase();
  const media = await requestResult<OfflineMediaRecord[]>(
    db.transaction(MEDIA_STORE, "readonly").objectStore(MEDIA_STORE).index("offlineLocalId").getAll(offlineLocalId),
  );
  db.close();
  return media;
}

export async function getOfflineMediaFiles(offlineLocalId: string) {
  const media = await getMedia(offlineLocalId);
  return media.map((item) => new File([item.blob], item.name, { type: item.type }));
}

async function deleteMedia(offlineLocalId: string) {
  const db = await openDatabase();
  const media = await getMedia(offlineLocalId);
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(MEDIA_STORE, "readwrite");
    media.forEach((item) => transaction.objectStore(MEDIA_STORE).delete(item.mediaId));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not remove synced media."));
  });
  db.close();
}

async function updateReport(record: OfflineReportRecord) {
  const db = await openDatabase();
  await requestResult(db.transaction(REPORT_STORE, "readwrite").objectStore(REPORT_STORE).put(record));
  db.close();
}

export async function deleteOfflineReport(offlineLocalId: string) {
  const db = await openDatabase();
  const media = await getMedia(offlineLocalId);
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([REPORT_STORE, MEDIA_STORE], "readwrite");
    transaction.objectStore(REPORT_STORE).delete(offlineLocalId);
    media.forEach((item) => transaction.objectStore(MEDIA_STORE).delete(item.mediaId));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not delete offline report."));
  });
  db.close();
}

export async function deleteOfflineReportsForUser(userId: string) {
  const records = await listOfflineReports(userId);
  await Promise.all(records.map((record) => deleteOfflineReport(record.offlineLocalId)));
}

async function findCloudReport(offlineLocalId: string, userId: string) {
  const reports = supabase.from("reports") as any;
  const { data, error } = await reports
    .select("id, public_issue_id")
    .eq("client_submission_id", offlineLocalId)
    .eq("citizen_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; public_issue_id: string } | null;
}

async function syncOne(record: OfflineReportRecord, userId: string) {
  if (record.userId !== userId || record.syncState === "sent") return record;
  const syncing = { ...record, syncState: "syncing" as const, updatedAt: new Date().toISOString(), error: null };
  await updateReport(syncing);

  try {
    const existing = await findCloudReport(record.offlineLocalId, userId);
    let cloudReport = existing;
    if (!cloudReport) {
      const reports = supabase.from("reports") as any;
      const { location_text: _locationText, language: _language, ...cloudPayload } = record.payload;
      const { data, error } = await reports
        .insert({
          ...cloudPayload,
          citizen_id: userId,
          public_issue_id: "",
          client_submission_id: record.offlineLocalId,
          latitude: record.payload.latitude,
          longitude: record.payload.longitude,
          location_accuracy_meters: record.payload.location_accuracy_meters,
          location_captured_at: record.payload.location_captured_at,
        })
        .select("id, public_issue_id")
        .single();
      if (error || !data) {
        const recovered = await findCloudReport(record.offlineLocalId, userId);
        if (!recovered) throw error ?? new Error("Could not create report.");
        cloudReport = recovered;
      } else {
        cloudReport = data as { id: string; public_issue_id: string };
      }
    }

    const media = await getMedia(record.offlineLocalId);
    for (const item of media) {
      const safeName = item.name.replace(/[^\w.-]/g, "_");
      const path = `${userId}/${cloudReport.id}/offline-${item.mediaId}-${safeName}`;
      const mediaQuery = supabase.from("report_media") as any;
      const { data: existingMedia, error: existingMediaError } = await mediaQuery
        .select("id")
        .eq("report_id", cloudReport.id)
        .eq("file_url", path)
        .maybeSingle();
      if (existingMediaError) throw existingMediaError;
      if (!existingMedia) {
        const { error: uploadError } = await supabase.storage
          .from("report-media")
          .upload(path, item.blob, { ...(item.type ? { contentType: item.type } : {}), upsert: true });
        if (uploadError) throw uploadError;
        const { error: mediaRowError } = await mediaQuery
          .insert({ report_id: cloudReport.id, file_url: path, file_type: item.type || null });
        if (mediaRowError) throw mediaRowError;
      }
    }

    const sent = {
      ...record,
      syncState: "sent" as const,
      cloudReportId: cloudReport.id,
      publicIssueId: cloudReport.public_issue_id,
      updatedAt: new Date().toISOString(),
      error: null,
    };
    await updateReport(sent);
    await deleteMedia(record.offlineLocalId);
    return sent;
  } catch (error) {
    const failed = {
      ...record,
      syncState: "needs_attention" as const,
      retryCount: record.retryCount + 1,
      updatedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Sync failed.",
    };
    await updateReport(failed);
    return failed;
  }
}

export async function syncOfflineReports(userId: string) {
  if (!navigator.onLine) return [];
  const records = await listOfflineReports(userId);
  const results: OfflineReportRecord[] = [];
  for (const record of records) {
    if (record.syncState === "sent") continue;
    results.push(await syncOne(record, userId));
  }
  return results;
}

export async function retryOfflineReport(offlineLocalId: string) {
  const record = await getOfflineReport(offlineLocalId);
  if (!record) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user || data.user.id !== record.userId) return record;
  return syncOne(record, data.user.id);
}
