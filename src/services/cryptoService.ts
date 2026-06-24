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
    const plainBytes = stringToBytes(plain);
    const xored = xorBytes(plainBytes);
    return bytesToBase64(xored);
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
  try {
    const xored = base64ToBytes(obfuscated);
    const plainBytes = xorBytes(xored);
    return bytesToString(plainBytes);
  } catch (error) {
    console.error('[CryptoService] Deobfuscation failed:', error);
    // If deobfuscation fails, the stored value might be plain text (legacy)
    return obfuscated;
  }
}
