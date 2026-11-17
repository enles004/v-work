import type { TrackerDoc } from "./tracker.js";

export interface TaskChanges {
  status?: string;
  owner?: string;
  due?: string;
  note?: string;
  prio?: string;
  release?: string;
}

export function findDoc(docs: TrackerDoc[], reference: string): TrackerDoc | undefined {
  const ref = reference.trim();
  if (ref.includes("/")) {
    const [collection, docId] = ref.split("/", 2);
    return docs.find(
      (doc) => doc.collection === collection && (doc.doc_id === docId || docCode(doc) === docId),
    );
  }
  const lower = ref.toLowerCase();
  return docs.find((doc) => docCode(doc).toLowerCase() === lower);
}

function docCode(doc: TrackerDoc): string {
  const data = (doc.data ?? {}) as Record<string, unknown>;
  const code = data.code ?? doc.doc_id;
  return String(code ?? "");
}

export function mergeTaskData(
  current: Record<string, unknown>,
  changes: TaskChanges,
): Record<string, unknown> {
  const merged = { ...current };
  for (const [key, value] of Object.entries(changes)) {
    if (value !== undefined && value !== "") merged[key] = value;
  }
  return merged;
}

export function hasChanges(changes: TaskChanges): boolean {
  return Object.values(changes).some((value) => value !== undefined && value !== "");
}
