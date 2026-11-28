// Builds tiny MP4/QuickTime-shaped buffers that carry (or lack) a location,
// so upload tests do not need large video files. The bytes are not playable
// video; they only have the box layout the location reader looks at.
const u32 = (n) => Buffer.from([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const u16 = (n) => Buffer.from([(n >>> 8) & 255, n & 255]);
const tag = (s) => Buffer.from(s, "latin1");
function box(type, ...parts) {
  const body = Buffer.concat(parts);
  return Buffer.concat([u32(8 + body.length), type, body]);
}
const T = (s) => tag(s);
const XYZ = Buffer.from([0xa9, 0x78, 0x79, 0x7a]);

function keysBox(names) {
  const entries = names.map((n) => Buffer.concat([u32(8 + Buffer.byteLength(n)), T("mdta"), Buffer.from(n, "utf8")]));
  return box(T("keys"), u32(0), u32(names.length), ...entries);
}
function ilstBox(values) {
  const items = values.map((v, i) =>
    box(u32(i + 1), box(T("data"), u32(1), u32(0), Buffer.from(v, "utf8")))
  );
  return box(T("ilst"), ...items);
}

// iPhone-style: moov > meta > keys + ilst. isoMeta adds the 4-byte
// version/flags word that ISO files put at the start of a meta box.
function quickTimeMeta(items, { isoMeta = false } = {}) {
  const names = Object.keys(items);
  const hdlr = box(T("hdlr"), u32(0), u32(0), T("mdta"), Buffer.alloc(12), Buffer.from([0]));
  return box(T("meta"), isoMeta ? u32(0) : Buffer.alloc(0), hdlr, keysBox(names), ilstBox(names.map((n) => items[n])));
}

function xyzAtom(text) {
  const s = Buffer.from(text, "utf8");
  return box(XYZ, u16(s.length), u16(0x15c7), s);
}

// opts: { iso6709, accuracy, xyz, isoMeta, moovFirst }
function makeVideo(opts = {}) {
  const ftyp = box(T("ftyp"), T("qt  "), u32(0), T("qt  "));
  const mdat = box(T("mdat"), Buffer.alloc(300000, 7));
  const mvhd = box(T("mvhd"), Buffer.alloc(100));
  const trak = box(T("trak"), box(T("tkhd"), Buffer.alloc(84)), box(T("mdia"), Buffer.alloc(2000)));
  const moovParts = [mvhd, trak];
  if (opts.iso6709) {
    const items = { "com.apple.quicktime.location.ISO6709": opts.iso6709 };
    if (opts.accuracy !== undefined) items["com.apple.quicktime.location.accuracy.horizontal"] = String(opts.accuracy);
    moovParts.push(quickTimeMeta(items, { isoMeta: Boolean(opts.isoMeta) }));
  }
  if (opts.xyz) moovParts.push(box(T("udta"), xyzAtom(opts.xyz)));
  const moov = box(T("moov"), ...moovParts);
  // Like a real phone clip, put moov after the media data by default.
  return opts.moovFirst ? Buffer.concat([ftyp, moov, mdat]) : Buffer.concat([ftyp, mdat, moov]);
}

module.exports = { makeVideo };
