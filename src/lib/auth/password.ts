const ITERATIONS = 100_000;

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function encodeBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

async function deriveHash(password: string, salt: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return encodeBase64(new Uint8Array(bits));
}

export async function verifyPassword(
  password: string,
  saltBase64: string,
  expectedHashBase64: string,
): Promise<boolean> {
  const hash = await deriveHash(password, decodeBase64(saltBase64));
  return hash === expectedHashBase64;
}

export async function hashPassword(password: string): Promise<{ saltB64: string; hashB64: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hashB64 = await deriveHash(password, salt);
  return { saltB64: encodeBase64(salt), hashB64 };
}

export function generateTemporaryPassword(length = 12): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}
