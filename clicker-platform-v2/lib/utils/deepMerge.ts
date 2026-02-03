/**
 * Deep merge utility for theme configurations.
 * Recursively merges source into target, preserving nested objects.
 */

type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

function isObject(item: unknown): item is Record<string, unknown> {
    return Boolean(item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * Deeply merges source into target.
 * - Nested objects are recursively merged
 * - Arrays are replaced (not concatenated)
 * - undefined values in source are ignored
 */
export function deepMerge<T extends object>(target: T, source: DeepPartial<T>): T {
    const output = { ...target } as T;

    for (const key in source) {
        const sourceValue = source[key];
        const targetValue = target[key];

        if (sourceValue === undefined) {
            continue;
        }

        if (isObject(sourceValue) && isObject(targetValue)) {
            (output as Record<string, unknown>)[key] = deepMerge(
                targetValue as object,
                sourceValue as DeepPartial<typeof targetValue>
            );
        } else {
            (output as Record<string, unknown>)[key] = sourceValue;
        }
    }

    return output;
}

/**
 * Merges multiple partial objects into a base object.
 * Useful for layered configuration (base → template → user overrides).
 */
export function mergeConfigs<T extends object>(base: T, ...overrides: DeepPartial<T>[]): T {
    return overrides.reduce<T>((acc, override) => deepMerge(acc, override), base);
}
