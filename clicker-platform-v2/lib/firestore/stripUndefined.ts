/**
 * Deep-clone the value, removing object keys whose value is `undefined`.
 * Firestore's setDoc/updateDoc reject `undefined` field values — call this
 * on any payload built from optional-field types before writing.
 *
 * Preserves `null`, `false`, `0`, and empty strings (only `undefined` is dropped).
 * Recurses into nested objects and arrays of objects. Arrays of primitives pass through.
 */
export function stripUndefined<T>(value: T): T {
    if (value === null || typeof value !== 'object') return value;

    if (Array.isArray(value)) {
        return value.map((v) => stripUndefined(v)) as unknown as T;
    }

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (v === undefined) continue;
        out[k] = stripUndefined(v);
    }
    return out as T;
}
