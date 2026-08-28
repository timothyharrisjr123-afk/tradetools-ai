/**
 * Cheap image dimension probe from original bytes.
 * JPEG / PNG / WebP only. Returns null rather than inventing size.
 */

export function probeImageDimensions(
  bytes: Uint8Array,
  mimeType: string
): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  if (mimeType === "image/png") return probePng(bytes);
  if (mimeType === "image/jpeg") return probeJpeg(bytes);
  if (mimeType === "image/webp") return probeWebp(bytes);
  return null;
}

function u16be(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! << 8) | bytes[offset + 1]!;
}

function u32be(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset]! << 24) |
      (bytes[offset + 1]! << 16) |
      (bytes[offset + 2]! << 8) |
      bytes[offset + 3]!) >>>
    0
  );
}

function u16le(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function probePng(bytes: Uint8Array): { width: number; height: number } | null {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < sig.length; i += 1) {
    if (bytes[i] !== sig[i]) return null;
  }
  const width = u32be(bytes, 16);
  const height = u32be(bytes, 20);
  if (width < 1 || height < 1) return null;
  return { width, height };
}

function probeJpeg(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1]!;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01) {
      offset += 2;
      continue;
    }
    if (marker >= 0xd0 && marker <= 0xd7) {
      offset += 2;
      continue;
    }
    const size = u16be(bytes, offset + 2);
    if (size < 2) return null;
    const sof =
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc5 ||
      marker === 0xc6 ||
      marker === 0xc7 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb;
    if (sof && offset + 8 < bytes.length) {
      const height = u16be(bytes, offset + 5);
      const width = u16be(bytes, offset + 7);
      if (width < 1 || height < 1) return null;
      return { width, height };
    }
    offset += 2 + size;
  }
  return null;
}

function probeWebp(bytes: Uint8Array): { width: number; height: number } | null {
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff !== "RIFF" || webp !== "WEBP") return null;
  const kind = String.fromCharCode(...bytes.slice(12, 16));
  if (kind === "VP8X" && bytes.length >= 30) {
    const width =
      1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16));
    const height =
      1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16));
    return width > 0 && height > 0 ? { width, height } : null;
  }
  if (kind === "VP8 " && bytes.length >= 30) {
    const width = u16le(bytes, 26) & 0x3fff;
    const height = u16le(bytes, 28) & 0x3fff;
    return width > 0 && height > 0 ? { width, height } : null;
  }
  if (kind === "VP8L" && bytes.length >= 25) {
    const bits =
      bytes[21]! | (bytes[22]! << 8) | (bytes[23]! << 16) | (bytes[24]! << 24);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return { width, height };
  }
  return null;
}
