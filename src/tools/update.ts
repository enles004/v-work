import type { TrackerDoc } from "./tracker.js";

// API chỉ cho sửa các field này; các field còn lại (code, feature, owner, due, prio…) là bất biến.
export interface TaskChanges {
  status?: string;
  note?: string;
}

export function findDoc(docs: TrackerDoc[], reference: string): TrackerDoc | undefined {
  const ref = reference.trim();
  if (ref.includes("/")) {
    const [collection, docId] = ref.split("/", 2);
    return docs.find(
      (doc) =>
        doc.collection === collection && (doc.doc_id === docId || docCode(doc) === docId),
    );
  }
  const lower = ref.toLowerCase();
  return docs.find((doc) => docCode(doc).toLowerCase() === lower);
}

function docCode(doc: TrackerDoc): string {
  const data = (doc.data ?? {}) as Record<string, unknown>;
  return String(data.code ?? doc.doc_id ?? "");
}

export function buildChanges(input: TaskChanges): TaskChanges {
  const changes: TaskChanges = {};
  if (input.status?.trim()) changes.status = input.status.trim();
  if (input.note !== undefined) changes.note = input.note;
  return changes;
}

export function hasChanges(changes: TaskChanges): boolean {
  return Object.keys(changes).length > 0;
}
