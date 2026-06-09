const ITERATIONS = 100_000;

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function verifyPassword(
  password: string,
  saltBase64: string,
  expectedHashBase64: string,
): Promise<boolean> {
  const salt = decodeBase64(saltBase64);
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  const hash = btoa(String.fromCharCode(...new Uint8Array(bits)));
  return hash === expectedHashBase64;
}
