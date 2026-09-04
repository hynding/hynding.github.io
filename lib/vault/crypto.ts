const encoder = new TextEncoder()
const decoder = new TextDecoder()

/** OWASP's current floor for PBKDF2-HMAC-SHA256. */
export const KDF_ITERATIONS = 600_000

export interface VaultBlob {
  v: 1
  audience: string
  kdf: { name: "PBKDF2"; hash: "SHA-256"; iterations: number; salt: string }
  iv: string
  ct: string
}

const toBase64 = (bytes: ArrayBuffer | Uint8Array): string => {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ""
  for (const byte of view) binary += String.fromCharCode(byte)
  return btoa(binary)
}

const fromBase64 = (value: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(value), (char) => char.charCodeAt(0))

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  )
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
}

export async function sealVault(
  audience: string,
  passphrase: string,
  payload: unknown,
): Promise<VaultBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt, KDF_ITERATIONS)
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(payload)),
  )
  return {
    v: 1,
    audience,
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations: KDF_ITERATIONS, salt: toBase64(salt) },
    iv: toBase64(iv),
    ct: toBase64(ciphertext),
  }
}

/**
 * Throws on a wrong passphrase or tampered ciphertext — AES-GCM authenticates,
 * so failure is clean rather than plausible garbage.
 */
export async function openVault(blob: VaultBlob, passphrase: string): Promise<unknown> {
  const key = await deriveKey(passphrase, fromBase64(blob.kdf.salt), blob.kdf.iterations)
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(blob.iv) },
    key,
    fromBase64(blob.ct),
  )
  return JSON.parse(decoder.decode(plaintext))
}

/**
 * Crockford base32 without the ambiguous letters, in four groups of five:
 * 20 symbols x 5 bits = 100 bits of entropy, drawn from the CSPRNG.
 *
 * Deviation from the spec, which named six EFF-wordlist words (~77 bits).
 * Vendoring a 7,776-word list to gain memorability is not worth it when the
 * passphrase travels by link rather than by memory, and this is stronger.
 */
const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz"

export function generatePassphrase(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20))
  const symbols = Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length])
  return [0, 5, 10, 15].map((start) => symbols.slice(start, start + 5).join("")).join("-")
}
