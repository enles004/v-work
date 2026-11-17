export function findDoc(docs, reference) {
    const ref = reference.trim();
    if (ref.includes("/")) {
        const [collection, docId] = ref.split("/", 2);
        return docs.find((doc) => doc.collection === collection && (doc.doc_id === docId || docCode(doc) === docId));
    }
    const lower = ref.toLowerCase();
    return docs.find((doc) => docCode(doc).toLowerCase() === lower);
}
function docCode(doc) {
    const data = (doc.data ?? {});
    return String(data.code ?? doc.doc_id ?? "");
}
export function buildChanges(input) {
    const changes = {};
    if (input.status?.trim())
        changes.status = input.status.trim();
    if (input.note !== undefined)
        changes.note = input.note;
    return changes;
}
export function hasChanges(changes) {
    return Object.keys(changes).length > 0;
}
