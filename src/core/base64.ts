// Standard padded base64, as the engine takes image and raster bytes. Written here
// because the engine's environment types no `Uint8Array.toBase64`.

const DIGITS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function toBase64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0)
    out += DIGITS[(n >> 18) & 63]! + DIGITS[(n >> 12) & 63]!
    out += b === undefined ? '=' : DIGITS[(n >> 6) & 63]!
    out += c === undefined ? '=' : DIGITS[n & 63]!
  }
  return out
}
