/**
 * StorageService — Abstraction layer over localStorage.
 * Provides type-safe get/set/remove/clearAll operations.
 */

/**
 * Reads a value from localStorage and parses it as JSON.
 * @param key - The storage key
 * @param defaultValue - Value returned if key doesn't exist or parsing fails
 * @returns The stored value or defaultValue
 */
export function get<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return defaultValue;
    }
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`[StorageService] Failed to read key "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Serializes a value to JSON and writes it to localStorage.
 * @param key - The storage key
 * @param value - The value to store
 */
export function set<T>(key: string, value: T): void {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
  } catch (error) {
    console.error(`[StorageService] Failed to write key "${key}":`, error);
    throw new Error(`存储失败：无法写入 "${key}"，可能存储空间已满。`);
  }
}

/**
 * Removes a key from localStorage.
 * @param key - The storage key
 */
export function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`[StorageService] Failed to remove key "${key}":`, error);
  }
}

/**
 * Clears all interviewdog-related keys from localStorage.
 */
export function clearAll(): void {
  try {
    localStorage.clear();
  } catch (error) {
    console.warn('[StorageService] Failed to clear localStorage:', error);
  }
}
