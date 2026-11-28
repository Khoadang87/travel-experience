// Reads the recording location from a video file, entirely in the browser.
//
// Only a few small slices of the file are read (box headers and the metadata
// boxes). Nothing is uploaded and no network request is made. Supported:
//   - QuickTime/iPhone: moov > meta > keys/ilst with the key
//     "com.apple.quicktime.location.ISO6709" (and the optional accuracy key)
//   - MP4/3GP/QuickTime: moov > udta > "©xyz" (ISO 6709 string)
// iOS can drop this metadata when a clip is picked from Photos, so a missing
// location is a normal result, not an error.

const MAX_META_BYTES = 8 * 1024 * 1024;
const MAX_BOXES = 256;

function fourcc(view, off) {
  return String.fromCharCode(view.getUint8(off), view.getUint8(off + 1), view.getUint8(off + 2), view.getUint8(off + 3));
}

async function readBytes(file, start, length) {
  const end = Math.min(file.size, start + length);
  if (end <= start) return new DataView(new ArrayBuffer(0));
  return new DataView(await file.slice(start, end).arrayBuffer());
}

// Reads one box header at `pos`. Returns null at the end or when malformed.
async function boxHeader(file, pos, limit) {
  if (pos + 8 > limit) return null;
  const head = await readBytes(file, pos, 16);
  if (head.byteLength < 8) return null;
  let size = head.getUint32(0);
  const type = fourcc(head, 4);
  let headerSize = 8;
  if (size === 1) {
    if (head.byteLength < 16) return null;
    size = head.getUint32(8) * 4294967296 + head.getUint32(12);
    headerSize = 16;
  } else if (size === 0) {
    size = limit - pos;
  }
  if (size < headerSize || pos + size > limit) {
    // A truncated box: trust it up to the limit but not past it.
    if (size < headerSize) return null;
    size = limit - pos;
  }
  return { type, start: pos, size, headerSize, bodyStart: pos + headerSize, end: pos + size };
}

async function* childBoxes(file, from, to) {
  let pos = from;
  let count = 0;
  while (pos < to && count < MAX_BOXES) {
    const box = await boxHeader(file, pos, to);
    if (!box) return;
    yield box;
    pos = box.end;
    count += 1;
  }
}

// Parses an ISO 6709 string such as "+34.0725-118.3598+059.157/".
export function parseISO6709(text) {
  if (typeof text !== "string") return null;
  const s = text.replace(/\0/g, "").trim();
  const m = /^([+-])(\d{2}|\d{4}|\d{6})(\.\d+)?([+-])(\d{3}|\d{5}|\d{7})(\.\d+)?(?:([+-]\d+(?:\.\d+)?))?(?:CRS[A-Za-z0-9_:]*)?\/?$/.exec(s);
  if (!m) return null;
  function toDegrees(sign, digits, frac, degLen) {
    const deg = Number(digits.slice(0, degLen));
    const min = digits.length >= degLen + 2 ? Number(digits.slice(degLen, degLen + 2)) : 0;
    const sec = digits.length >= degLen + 4 ? Number(digits.slice(degLen + 2, degLen + 4)) : 0;
    const fracNum = frac ? Number(frac) : 0;
    let value;
    if (digits.length === degLen) value = deg + fracNum;
    else if (digits.length === degLen + 2) value = deg + (min + fracNum) / 60;
    else value = deg + min / 60 + (sec + fracNum) / 3600;
    return sign === "-" ? -value : value;
  }
  const lat = toDegrees(m[1], m[2], m[3], 2);
  const lng = toDegrees(m[4], m[5], m[6], 3);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  const out = { lat, lng };
  if (m[7] !== undefined) {
    const alt = Number(m[7]);
    if (Number.isFinite(alt)) out.altitude = alt;
  }
  return out;
}

function utf8(view, start, end) {
  const bytes = new Uint8Array(view.buffer, view.byteOffset + start, Math.max(0, end - start));
  return new TextDecoder("utf-8").decode(bytes);
}

// udta > "©xyz": uint16 length, uint16 language, then the text.
function parseXyz(view) {
  if (view.byteLength < 5) return null;
  const len = view.getUint16(0);
  const end = Math.min(view.byteLength, 4 + len);
  return parseISO6709(utf8(view, 4, end > 4 ? end : view.byteLength));
}

const META_CHILDREN = new Set(["hdlr", "keys", "ilst", "ctry", "lang"]);

// Finds the first child box offset of a `meta` box (with or without the
// ISO version/flags word).
async function metaBodyStart(file, box) {
  const probe = await readBytes(file, box.bodyStart, 8);
  if (probe.byteLength >= 8 && META_CHILDREN.has(fourcc(probe, 4))) return box.bodyStart;
  return box.bodyStart + 4;
}

async function parseMeta(file, box) {
  const out = {};
  const start = await metaBodyStart(file, box);
  let keys = null;
  let ilst = null;
  for await (const child of childBoxes(file, start, box.end)) {
    if (child.type === "keys" && child.size <= MAX_META_BYTES) keys = child;
    else if (child.type === "ilst" && child.size <= MAX_META_BYTES) ilst = child;
  }
  if (!keys || !ilst) return out;
  const keyView = await readBytes(file, keys.bodyStart, keys.size - keys.headerSize);
  if (keyView.byteLength < 8) return out;
  const count = keyView.getUint32(4);
  const names = [];
  let off = 8;
  for (let i = 0; i < count && off + 8 <= keyView.byteLength; i++) {
    const size = keyView.getUint32(off);
    if (size < 8 || off + size > keyView.byteLength) break;
    names.push(utf8(keyView, off + 8, off + size));
    off += size;
  }
  const listView = await readBytes(file, ilst.bodyStart, ilst.size - ilst.headerSize);
  off = 0;
  while (off + 8 <= listView.byteLength) {
    const size = listView.getUint32(off);
    if (size < 8 || off + size > listView.byteLength) break;
    const index = listView.getUint32(off + 4); // 1-based index into keys
    const name = names[index - 1];
    // Inside the item: a "data" box = size, "data", type(4), locale(4), value.
    if (name && size >= 24 && fourcc(listView, off + 12) === "data") {
      out[name] = utf8(listView, off + 24, off + size);
    }
    off += size;
  }
  return out;
}

// Returns { lat, lng, accuracy?, altitude?, source } or null.
export async function readVideoLocation(file) {
  if (!file || typeof file.slice !== "function" || !file.size) return null;
  let moov = null;
  let topMeta = null;
  for await (const box of childBoxes(file, 0, file.size)) {
    if (box.type === "moov") moov = box;
    else if (box.type === "meta") topMeta = box;
  }
  const scopes = [];
  if (moov) {
    for await (const child of childBoxes(file, moov.bodyStart, moov.end)) {
      if (child.type === "meta") scopes.push({ kind: "meta", box: child });
      else if (child.type === "udta") scopes.push({ kind: "udta", box: child });
    }
  }
  if (topMeta) scopes.push({ kind: "meta", box: topMeta });

  let found = null;
  let accuracy = null;
  for (const scope of scopes) {
    if (scope.kind === "meta") {
      const items = await parseMeta(file, scope.box);
      const iso = items["com.apple.quicktime.location.ISO6709"];
      const parsed = iso ? parseISO6709(iso) : null;
      if (parsed && !found) {
        found = { ...parsed, source: "QuickTime location metadata" };
        const acc = Number(items["com.apple.quicktime.location.accuracy.horizontal"]);
        if (Number.isFinite(acc) && acc >= 0) accuracy = acc;
      }
    } else {
      for await (const child of childBoxes(file, scope.box.bodyStart, scope.box.end)) {
        if (child.type === "\u00a9xyz" && !found && child.size <= 4096) {
          const view = await readBytes(file, child.bodyStart, child.size - child.headerSize);
          const parsed = parseXyz(view);
          if (parsed) found = { ...parsed, source: "MP4 location atom" };
        }
      }
    }
    if (found) break;
  }
  if (!found) return null;
  if (accuracy !== null) found.accuracy = accuracy;
  return found;
}
