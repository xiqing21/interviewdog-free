/**
 * CryptoService — Simple API Key obfuscation using base64 + XOR.
 *
 * NOTE: This is NOT cryptographic security. It only prevents the API key
 * from being stored in plain text in localStorage. A determined attacker
 * with access to the browser can still reverse this. For true security,
 * use a backend proxy.
 */

// XOR key — a fixed string used to scramble the key
const XOR_KEY = 'InterviewDog2026_Free_Edition_SecretKey';
const OBFUSCATED_PREFIX = 'obf:';

/**
 * Converts a string to a UTF-8 byte array.
 */
function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Converts a byte array back to a UTF-8 string.
 */
function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/**
 * Converts a byte array to a base64 string.
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts a base64 string to a byte array.
 */
function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * XORs a byte array with the repeating XOR_KEY.
 */
function xorBytes(bytes: Uint8Array): Uint8Array {
  const keyBytes = stringToBytes(XOR_KEY);
  const result = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    result[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return result;
}

/**
 * Obfuscates a plain text API key.
 * @param plain - The plain text API key
 * @returns Obfuscated string (safe to store in localStorage)
 */
export function obfuscate(plain: string): string {
  if (!plain) {
    return '';
  }
  try {
    if (plain.startsWith(OBFUSCATED_PREFIX)) return plain;
    const plainBytes = stringToBytes(plain);
    const xored = xorBytes(plainBytes);
    return `${OBFUSCATED_PREFIX}${bytesToBase64(xored)}`;
  } catch (error) {
    console.error('[CryptoService] Obfuscation failed:', error);
    return plain;
  }
}

/**
 * Deobfuscates an obfuscated API key back to plain text.
 * @param obfuscated - The obfuscated string
 * @returns The original plain text API key
 */
export function deobfuscate(obfuscated: string): string {
  if (!obfuscated) {
    return '';
  }
  if (!obfuscated.startsWith(OBFUSCATED_PREFIX) && !looksLikeLegacyObfuscated(obfuscated)) {
    return obfuscated;
  }
  try {
    const payload = obfuscated.startsWith(OBFUSCATED_PREFIX)
      ? obfuscated.slice(OBFUSCATED_PREFIX.length)
      : obfuscated;
    const xored = base64ToBytes(payload);
    const plainBytes = xorBytes(xored);
    const plain = bytesToString(plainBytes);
    return isReadableSecret(plain) ? plain : obfuscated;
  } catch (error) {
    // If deobfuscation fails, the stored value might be plain text (legacy)
    return obfuscated;
  }
}

function looksLikeLegacyObfuscated(value: string): boolean {
  if (!/^[A-Za-z0-9+/=]+$/.test(value)) return false;
  if (value.length % 4 !== 0) return false;
  return value.length >= 12;
}

function isReadableSecret(value: string): boolean {
  if (!value) return false;
  return /^[\x20-\x7E]+$/.test(value);
}
