// Import dei PDF salvati dalla lavagna Microsoft: i tratti diventano forme esatte, poi testi e immagini.
// Il PDF si aggiunge al foglio già selezionato, come un incolla: Annulla lo toglie tutto insieme.

import { afterChange, record } from './history.js';
import { commitPlace } from './images.js';
import { forTiles, paint } from './layers.js';
import { shiftOp } from './objects.js';
import { Lexer, Name, Op, PdfError, Ref, latin1, readPdf } from './pdf-read.js';
import { clearSel, setSel } from './selection.js';
import { setName } from './sheet-info.js';
import { S, pan } from './state.js';
import { commitEdit } from './text-editor.js';
import { textBB, textBase } from './text-render.js';
import { toast } from './toast.js';
import { setTool } from './tray.js';
import { setView } from './view.js';

const PX = 4 / 3;  // punti PDF → px della lavagna

const CURVE_TOL = .25;  // errore massimo delle curve spezzate in segmenti, in px

const SIMPLIFY_TOL = .12;  // punti tolti dai contorni se si spostano meno di così, in px

const mul = (m, n) => [
  m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3],
  m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3],
  m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5],
];

const tp = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

const scaleOf = m => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));

const hex = (r, g, b) => '#' + [r, g, b].map(v => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');

function color(args) {
  const a = args.filter(v => typeof v === 'number');
  if (a.length === 1) return hex(a[0], a[0], a[0]);
  if (a.length === 3) return hex(a[0], a[1], a[2]);
  if (a.length === 4) { const [c, m, y, k] = a; return hex((1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k)); }
  return null;
}

// Douglas-Peucker su coppie x, y
function simplify(pts, tol) {
  const n = pts.length / 2;
  if (n < 3) return pts;
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack = [0, n - 1], t2 = tol * tol;
  while (stack.length) {
    const b = stack.pop(), a = stack.pop();
    const ax = pts[2 * a], ay = pts[2 * a + 1], dx = pts[2 * b] - ax, dy = pts[2 * b + 1] - ay, L = dx * dx + dy * dy;
    let md = 0, mi = -1;
    for (let i = a + 1; i < b; i++) {
      const px = pts[2 * i] - ax, py = pts[2 * i + 1] - ay;
      const t = L ? Math.max(0, Math.min(1, (px * dx + py * dy) / L)) : 0;
      const ex = px - t * dx, ey = py - t * dy, d = ex * ex + ey * ey;
      if (d > md) { md = d; mi = i; }
    }
    if (md > t2) { keep[mi] = 1; stack.push(a, mi, mi, b); }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[2 * i], pts[2 * i + 1]);
  return out;
}

/* Percorso in costruzione, già in coordinate della lavagna */
class Path {
  constructor() { this.subs = []; this.cur = null; this.cx = 0; this.cy = 0; this.sx = 0; this.sy = 0; }

  move(x, y) { this.cur = { pts: [x, y], closed: false }; this.subs.push(this.cur); this.cx = this.sx = x; this.cy = this.sy = y; }

  line(x, y) {
    if (!this.cur) this.move(this.cx, this.cy);
    this.cur.pts.push(x, y);
    this.cx = x; this.cy = y;
  }

  curve(x1, y1, x2, y2, x3, y3) {
    const x0 = this.cx, y0 = this.cy;
    const d = Math.max(Math.hypot(x0 - 2 * x1 + x2, y0 - 2 * y1 + y2), Math.hypot(x1 - 2 * x2 + x3, y1 - 2 * y2 + y3));
    const n = Math.min(64, Math.max(1, Math.ceil(Math.sqrt(.75 * d / CURVE_TOL))));
    for (let k = 1; k <= n; k++) {
      const t = k / n, u = 1 - t;
      const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, e = t * t * t;
      this.line(a * x0 + b * x1 + c * x2 + e * x3, a * y0 + b * y1 + c * y2 + e * y3);
    }
  }

  close() {
    if (this.cur) { this.cur.closed = true; this.cur = null; }
    this.cx = this.sx; this.cy = this.sy;
  }

  bbox() {
    const bb = [Infinity, Infinity, -Infinity, -Infinity];
    for (const s of this.subs) for (let i = 0; i < s.pts.length; i += 2) {
      bb[0] = Math.min(bb[0], s.pts[i]); bb[1] = Math.min(bb[1], s.pts[i + 1]);
      bb[2] = Math.max(bb[2], s.pts[i]); bb[3] = Math.max(bb[3], s.pts[i + 1]);
    }
    return bb;
  }

  // Terne x, y, segno: 1 inizio di un sottopercorso, 2 chiusura dopo questo punto
  triples() {
    const out = [];
    for (const s of this.subs) {
      const pts = simplify(s.pts, SIMPLIFY_TOL);
      for (let i = 0; i < pts.length; i += 2) out.push(Math.round(pts[i] * 100) / 100, Math.round(pts[i + 1] * 100) / 100, i === 0 ? 1 : 0);
      if (s.closed && pts.length > 2) out[out.length - 1] = 2;
    }
    return out;
  }
}

/* Font: codici, larghezze e testo Unicode */
const utf16 = h => {
  let s = '';
  for (let i = 0; i + 3 < h.length; i += 4) s += String.fromCharCode(parseInt(h.slice(i, i + 4), 16));
  return s;
};

async function loadFont(pdf, ref, cache) {
  const key = ref instanceof Ref ? ref.num : ref;
  if (cache.has(key)) return cache.get(key);
  const d = pdf.get(ref) || {};
  const sub = pdf.name(d.Subtype);
  const font = { bytes: sub === 'Type0' ? 2 : 1, widths: new Map(), dw: 0, fm: .001, uni: new Map() };
  if (sub === 'Type0') {
    const cid = pdf.get(pdf.get(d.DescendantFonts)?.[0]) || {};
    font.dw = pdf.get(cid.DW) ?? 1000;
    const W = (pdf.get(cid.W) || []).map(v => pdf.get(v));
    for (let i = 0; i < W.length;) {
      const c = W[i], next = W[i + 1];
      if (Array.isArray(next)) { next.forEach((w, j) => font.widths.set(c + j, pdf.get(w))); i += 2; }
      else { for (let k = c; k <= next; k++) font.widths.set(k, W[i + 2]); i += 3; }
    }
  } else {
    const fc = pdf.get(d.FirstChar) || 0;
    (pdf.get(d.Widths) || []).forEach((w, i) => font.widths.set(fc + i, pdf.get(w)));
    if (sub === 'Type3') { const m = pdf.get(d.FontMatrix); if (m) font.fm = pdf.get(m[0]); }
  }
  if (d.ToUnicode instanceof Ref) {
    try {
      const t = latin1((await pdf.data(d.ToUnicode)).bytes);
      const cs = /begincodespacerange\s*<([0-9a-fA-F]+)>/.exec(t);
      if (cs) font.bytes = Math.max(1, cs[1].length / 2);
      for (const b of t.matchAll(/beginbfchar([\s\S]*?)endbfchar/g))
        for (const m of b[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g)) font.uni.set(parseInt(m[1], 16), utf16(m[2]));
      for (const b of t.matchAll(/beginbfrange([\s\S]*?)endbfrange/g))
        for (const m of b[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<[0-9a-fA-F]*>|\[[^\]]*\])/g)) {
          const a = parseInt(m[1], 16), z = parseInt(m[2], 16);
          if (z - a > 65535) continue;
          if (m[3][0] === '[') {
            [...m[3].matchAll(/<([0-9a-fA-F]*)>/g)].forEach((x, i) => font.uni.set(a + i, utf16(x[1])));
          } else {
            const h = m[3].slice(1, -1), head = h.slice(0, -4), last = parseInt(h.slice(-4), 16);
            for (let c = a; c <= z; c++) font.uni.set(c, utf16(head + (last + c - a).toString(16).padStart(4, '0')));
          }
        }
    } catch {}
  }
  cache.set(key, font);
  return font;
}

/* Immagini */
async function csInfo(pdf, v) {
  v = pdf.get(v);
  const name = v instanceof Name ? v.n : Array.isArray(v) ? pdf.name(v[0]) : null;
  if (name === 'DeviceRGB' || name === 'CalRGB' || name === 'RGB') return { n: 3 };
  if (name === 'DeviceGray' || name === 'CalGray' || name === 'G') return { n: 1 };
  if (name === 'DeviceCMYK' || name === 'CMYK') return { n: 4 };
  if (name === 'ICCBased') {
    const r = pdf.raw(v[1]);
    const n = pdf.get(r?.dict.N) || 3;
    return { n };
  }
  if (name === 'Indexed' || name === 'I') {
    const base = await csInfo(pdf, v[1]);
    let lk = pdf.get(v[3]);
    lk = typeof lk === 'string' ? Uint8Array.from(lk, ch => ch.charCodeAt(0)) : (await pdf.data(v[3])).bytes;
    return { n: 1, base, lookup: lk };
  }
  throw new PdfError('spazio colore non supportato');
}

// Campioni di un'immagine come numeri 0..(2^bpc - 1), riga per riga
function samples(bytes, w, h, comps, bpc) {
  const out = new Uint16Array(w * h * comps);
  if (bpc === 8) { out.set(bytes.subarray(0, out.length)); return out; }
  const rowBytes = Math.ceil(w * comps * bpc / 8);
  for (let y = 0; y < h; y++) {
    let bit = 0;
    const row = y * rowBytes;
    for (let i = 0; i < w * comps; i++) {
      if (bpc === 16) out[y * w * comps + i] = (bytes[row + 2 * i] << 8 | bytes[row + 2 * i + 1]) >> 8;
      else {
        const byte = bytes[row + (bit >> 3)];
        out[y * w * comps + i] = (byte >> (8 - bpc - (bit & 7))) & ((1 << bpc) - 1);
        bit += bpc;
      }
    }
  }
  return out;
}

async function decodeImage(pdf, ref) {
  const { dict } = pdf.raw(ref);
  const w = pdf.get(dict.Width), h = pdf.get(dict.Height);
  if (!w || !h || w * h > 40e6) throw new PdfError('immagine troppo grande');
  const d = await pdf.data(ref);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  let img;
  if (d.jpeg) {
    const bmp = await createImageBitmap(new Blob([d.bytes], { type: 'image/jpeg' }));
    ctx.drawImage(bmp, 0, 0, w, h);
    if (!dict.SMask) return c;
    img = ctx.getImageData(0, 0, w, h);
  } else {
    const bpc = pdf.get(dict.BitsPerComponent) || 8;
    const cs = await csInfo(pdf, dict.ColorSpace);
    const s = samples(d.bytes, w, h, cs.n, bpc), max = bpc === 16 ? 255 : (1 << bpc) - 1;
    img = ctx.createImageData(w, h);
    const px = img.data;
    for (let i = 0; i < w * h; i++) {
      let r, g, b;
      if (cs.lookup) {
        const bn = cs.base.n, j = Math.min(s[i], (cs.lookup.length / bn | 0) - 1) * bn, L = cs.lookup;
        if (bn === 1) r = g = b = L[j];
        else if (bn === 4) { const k = 255 - L[j + 3]; r = (255 - L[j]) * k / 255; g = (255 - L[j + 1]) * k / 255; b = (255 - L[j + 2]) * k / 255; }
        else { r = L[j]; g = L[j + 1]; b = L[j + 2]; }
      } else if (cs.n === 1) r = g = b = s[i] * 255 / max;
      else if (cs.n === 4) {
        const j = i * 4, k = 1 - s[j + 3] / max;
        r = 255 * (1 - s[j] / max) * k; g = 255 * (1 - s[j + 1] / max) * k; b = 255 * (1 - s[j + 2] / max) * k;
      } else { const j = i * 3; r = s[j] * 255 / max; g = s[j + 1] * 255 / max; b = s[j + 2] * 255 / max; }
      px[i * 4] = r; px[i * 4 + 1] = g; px[i * 4 + 2] = b; px[i * 4 + 3] = 255;
    }
  }
  if (dict.SMask instanceof Ref) {
    try {
      const md = pdf.raw(dict.SMask).dict;
      const mw = pdf.get(md.Width), mh = pdf.get(md.Height), mb = pdf.get(md.BitsPerComponent) || 8;
      const m = samples((await pdf.data(dict.SMask)).bytes, mw, mh, 1, mb), mmax = mb === 16 ? 255 : (1 << mb) - 1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        img.data[(y * w + x) * 4 + 3] = m[Math.floor(y * mh / h) * mw + Math.floor(x * mw / w)] * 255 / mmax;
      }
    } catch {}
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/* Esecuzione del content stream */
class Runner {
  constructor(pdf, out, pageBB) {
    this.pdf = pdf; this.out = out; this.pageBB = pageBB;
    this.fonts = new Map();
    this.glyphs = [];
    this.images = [];
  }

  async run(text, res, gs, depth = 0) {
    const pdf = this.pdf, lx = new Lexer(text), args = [], stack = [];
    let path = new Path(), clipNext = false, tm = [1, 0, 0, 1, 0, 0], tlm = tm;
    const P = (x, y) => tp(gs.ctm, x, y);
    const td = (x, y) => { tlm = mul([1, 0, 0, 1, x, y], tlm); tm = tlm; };
    const endPath = () => {
      if (clipNext) {
        const b = path.bbox();
        gs.clip = gs.clip ? [Math.max(gs.clip[0], b[0]), Math.max(gs.clip[1], b[1]), Math.min(gs.clip[2], b[2]), Math.min(gs.clip[3], b[3])] : b;
      }
      clipNext = false;
      path = new Path();
    };
    const show = async str => {
      const f = gs.font;
      if (!f) return;
      for (let i = 0; i + f.bytes <= str.length; i += f.bytes) {
        let code = 0;
        for (let k = 0; k < f.bytes; k++) code = code * 256 + str.charCodeAt(i + k);
        const m = mul(tm, gs.ctm);
        const [x, y] = tp(m, 0, gs.Ts);
        const w0 = (f.widths.get(code) ?? f.dw) * f.fm;
        const adv = (w0 * gs.size + gs.Tc + (code === 32 && f.bytes === 1 ? gs.Tw : 0)) * gs.Tz;
        tm = mul([1, 0, 0, 1, adv, 0], tm);
        const ch = f.uni.get(code) ?? (f.bytes === 1 ? String.fromCharCode(code) : '');
        if (gs.Tr === 3 || gs.Tr === 7 || !ch) continue;
        const ex = tp(mul(tm, gs.ctm), 0, gs.Ts)[0];
        const size = Math.hypot(m[2], m[3]) * gs.size;
        this.glyphs.push({ x, y, ex, ch, size, c: gs.fill });
      }
    };
    for (;;) {
      const v = lx.next(false);
      if (v === undefined) break;
      if (!(v instanceof Op)) { args.push(v); continue; }
      const op = v.op, a = args;
      switch (op) {
        case 'q': stack.push(gs); gs = { ...gs }; break;
        case 'Q': if (stack.length) gs = stack.pop(); break;
        case 'cm': gs.ctm = mul(a.slice(0, 6), gs.ctm); break;
        case 'w': gs.lw = a[0]; break;
        case 'J': gs.lc = a[0]; break;
        case 'j': gs.lj = a[0]; break;
        case 'gs': {
          const e = pdf.get(pdf.get(res.ExtGState)?.[a[0]?.n]) || {};
          if (typeof pdf.get(e.CA) === 'number') gs.CA = pdf.get(e.CA);
          if (typeof pdf.get(e.ca) === 'number') gs.ca = pdf.get(e.ca);
          if (typeof pdf.get(e.LW) === 'number') gs.lw = pdf.get(e.LW);
          const bm = pdf.get(e.BM);
          if (bm) gs.mul = (Array.isArray(bm) ? pdf.name(bm[0]) : pdf.name(bm)) === 'Multiply';
          break;
        }
        case 'RG': case 'G': case 'K': case 'SC': case 'SCN': { const c = color(a); if (c) gs.stroke = c; break; }
        case 'rg': case 'g': case 'k': case 'sc': case 'scn': { const c = color(a); if (c) gs.fill = c; break; }
        case 'm': path.move(...P(a[0], a[1])); break;
        case 'l': path.line(...P(a[0], a[1])); break;
        case 'c': path.curve(...P(a[0], a[1]), ...P(a[2], a[3]), ...P(a[4], a[5])); break;
        case 'v': path.curve(path.cx, path.cy, ...P(a[0], a[1]), ...P(a[2], a[3])); break;
        case 'y': { const e = P(a[2], a[3]); path.curve(...P(a[0], a[1]), ...e, ...e); break; }
        case 're': {
          const [x, y, w, h] = a;
          path.move(...P(x, y)); path.line(...P(x + w, y)); path.line(...P(x + w, y + h)); path.line(...P(x, y + h)); path.close();
          break;
        }
        case 'h': path.close(); break;
        case 'W': case 'W*': clipNext = true; break;
        case 'n': endPath(); break;
        case 'f': case 'F': case 'f*': case 'S': case 's': case 'B': case 'B*': case 'b': case 'b*':
          if (op === 's' || op === 'b' || op === 'b*') path.close();
          this.emit(path, gs, op !== 'S' && op !== 's', op === 'S' || op === 's' || op[0] === 'B' || op[0] === 'b', op.endsWith('*'));
          endPath();
          break;
        case 'BT': tm = tlm = [1, 0, 0, 1, 0, 0]; break;
        case 'Tf': gs.font = await loadFont(pdf, pdf.get(res.Font)?.[a[0]?.n], this.fonts); gs.size = a[1]; break;
        case 'Tc': gs.Tc = a[0]; break;
        case 'Tw': gs.Tw = a[0]; break;
        case 'Tz': gs.Tz = a[0] / 100; break;
        case 'TL': gs.TL = a[0]; break;
        case 'Ts': gs.Ts = a[0]; break;
        case 'Tr': gs.Tr = a[0]; break;
        case 'Td': td(a[0], a[1]); break;
        case 'TD': gs.TL = -a[1]; td(a[0], a[1]); break;
        case 'Tm': tlm = tm = a.slice(0, 6); break;
        case 'T*': td(0, -gs.TL); break;
        case 'Tj': await show(a[0] || ''); break;
        case "'": td(0, -gs.TL); await show(a[0] || ''); break;
        case '"': gs.Tw = a[0]; gs.Tc = a[1]; td(0, -gs.TL); await show(a[2] || ''); break;
        case 'TJ':
          for (const e of a[0] || []) {
            if (typeof e === 'string') await show(e);
            else if (typeof e === 'number') tm = mul([1, 0, 0, 1, -e / 1000 * gs.size * gs.Tz, 0], tm);
          }
          break;
        case 'Do': {
          const ref = pdf.get(res.XObject)?.[a[0]?.n];
          const x = ref instanceof Ref ? pdf.raw(ref) : null;
          if (!x) break;
          const sub = pdf.name(x.dict.Subtype);
          if (sub === 'Image') this.images.push({ ref, gs: { ...gs }, at: this.out.length });
          else if (sub === 'Form' && depth < 12) {
            const m = (pdf.get(x.dict.Matrix) || [1, 0, 0, 1, 0, 0]).map(v => pdf.get(v));
            await this.run(await pdf.content(ref), pdf.get(x.dict.Resources) || res, { ...gs, ctm: mul(m, gs.ctm) }, depth + 1);
          }
          break;
        }
        case 'BI': {
          const i = text.slice(lx.pos).search(/\sEI(?=[\s]|$)/);
          lx.pos = i < 0 ? text.length : lx.pos + i + 3;
          break;
        }
      }
      args.length = 0;
    }
  }

  emit(path, gs, fill, stroke, evenOdd) {
    if (!path.subs.length) return;
    const bb = path.bbox();
    if (!(bb[2] >= bb[0])) return;
    const sw = gs.lw * scaleOf(gs.ctm);
    const last = this.out[this.out.length - 1];
    if (fill && !stroke && gs.fill === '#ffffff' && path.subs.length === 1) {
      // lo sfondo bianco della pagina non serve
      const pb = this.pageBB, area = (pb[2] - pb[0]) * (pb[3] - pb[1]);
      if ((bb[2] - bb[0]) * (bb[3] - bb[1]) >= .9 * area) return;
    }
    // il filo sottilissimo sopra un tratto appena riempito, sullo stesso contorno
    if (stroke && !fill && sw < .5 && last?.k === 'sh' && last.c === gs.stroke && !last.sc &&
      Math.abs(last.raw[0] - bb[0]) < 1 && Math.abs(last.raw[1] - bb[1]) < 1 && Math.abs(last.raw[2] - bb[2]) < 1 && Math.abs(last.raw[3] - bb[3]) < 1) return;
    const p = path.triples();
    if (!p.length) return;
    const op = { k: 'sh', p, raw: bb };
    if (fill) op.c = gs.fill;
    if (evenOdd && fill) op.fr = 'evenodd';
    if (stroke) {
      op.sc = gs.stroke;
      op.sw = Math.max(.5, Math.round(sw * 100) / 100);
      if (gs.lc) op.lc = gs.lc;
      if (gs.lj) op.lj = gs.lj;
    }
    const alpha = fill ? gs.ca : gs.CA;
    if (alpha < .999) op.a = Math.round(alpha * 1000) / 1000;
    if (gs.mul) op.mul = 1;
    const pad = (stroke ? op.sw / 2 : 0) + 1;
    op.bb = [bb[0] - pad, bb[1] - pad, bb[2] + pad, bb[3] + pad];
    this.out.push(op);
  }

  // Lettere vicine sulla stessa linea diventano un testo solo
  texts() {
    const runs = [];
    let run = null;
    for (const g of this.glyphs) {
      const ok = run && g.c === run.c && Math.abs(g.size - run.size) < run.size * .1 && Math.abs(g.y - run.y) < run.size * .3 &&
        g.x > run.ex - run.size * .5 && g.x - run.ex < run.size * 2;
      if (!ok) { run = { x: g.x, y: g.y, ex: g.ex, size: g.size, c: g.c, t: g.ch }; runs.push(run); continue; }
      if (g.x - run.ex > run.size * .2 && !run.t.endsWith(' ') && g.ch !== ' ') run.t += ' ';
      run.t += g.ch;
      run.ex = g.ex;
    }
    return runs.filter(r => r.t.trim()).map(r => {
      const s = Math.round(r.size * 10) / 10;
      const op = { k: 'tx', x: Math.round(r.x * 10) / 10, y: Math.round((r.y - textBase(s)) * 10) / 10, t: r.t.trim(), s, c: r.c };
      op.bb = textBB(op);
      return op;
    });
  }

  async image(it) {
    const m = it.gs.ctm;
    const p00 = tp(m, 0, 0), p10 = tp(m, 1, 0), p01 = tp(m, 0, 1), p11 = tp(m, 1, 1);
    const xs = [p00[0], p10[0], p01[0], p11[0]], ys = [p00[1], p10[1], p01[1], p11[1]];
    const bb = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    const c = await decodeImage(this.pdf, it.ref);
    // la prima riga dell'immagine sta in y = 1 dello spazio dell'immagine
    const flipY = p01[1] > p00[1], flipX = p10[0] < p00[0];
    let src = [0, 0, c.width, c.height], dst = bb.slice();
    const clip = it.gs.clip;
    if (clip) {
      dst = [Math.max(bb[0], clip[0]), Math.max(bb[1], clip[1]), Math.min(bb[2], clip[2]), Math.min(bb[3], clip[3])];
      if (dst[2] - dst[0] < 1 || dst[3] - dst[1] < 1) return null;
      const kx = c.width / (bb[2] - bb[0]), ky = c.height / (bb[3] - bb[1]);
      let sx0 = (dst[0] - bb[0]) * kx, sx1 = (dst[2] - bb[0]) * kx, sy0 = (dst[1] - bb[1]) * ky, sy1 = (dst[3] - bb[1]) * ky;
      if (flipX) [sx0, sx1] = [c.width - sx1, c.width - sx0];
      if (flipY) [sy0, sy1] = [c.height - sy1, c.height - sy0];
      src = [sx0, sy0, sx1 - sx0, sy1 - sy0];
    }
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(src[2])); out.height = Math.max(1, Math.round(src[3]));
    const x = out.getContext('2d');
    x.setTransform(flipX ? -1 : 1, 0, 0, flipY ? -1 : 1, flipX ? out.width : 0, flipY ? out.height : 0);
    x.drawImage(c, src[0], src[1], src[2], src[3], 0, 0, out.width, out.height);
    const blob = await new Promise(r => out.toBlob(r, 'image/png'));
    const bmp = await createImageBitmap(blob);
    const w = dst[2] - dst[0], h = dst[3] - dst[1];
    return { k: 'im', x: dst[0], y: dst[1], w, h, bmp, blob, bb: [dst[0] - 1, dst[1] - 1, dst[2] + 1, dst[3] + 1] };
  }
}

async function convert(pdf) {
  const all = [];
  let yOff = 0, skipped = 0;
  for (const page of pdf.pages()) {
    const mb = page.MediaBox;
    const base = [PX, 0, 0, -PX, -PX * mb[0], PX * mb[3] + yOff];
    const pageBB = [0, yOff, PX * (mb[2] - mb[0]), yOff + PX * (mb[3] - mb[1])];
    const out = [];
    const r = new Runner(pdf, out, pageBB);
    const gs = { ctm: base, fill: '#000000', stroke: '#000000', lw: 1, lc: 0, lj: 0, ca: 1, CA: 1, mul: false, clip: null,
      font: null, size: 0, Tc: 0, Tw: 0, Tz: 1, TL: 0, Ts: 0, Tr: 0 };
    await r.run(await pdf.content(page.Contents), page.Resources, gs);
    // le immagini al loro posto nell'ordine di disegno
    for (let i = r.images.length - 1; i >= 0; i--) {
      try {
        const im = await r.image(r.images[i]);
        if (im) out.splice(r.images[i].at, 0, im);
      } catch { skipped++; }
    }
    for (const o of out) delete o.raw;
    all.push(...out, ...r.texts());
    yOff = pageBB[3] + 40;
  }
  return { list: all, skipped };
}

const baseName = f => f.replace(/\.pdf$/i, '');

export async function importPdf(file) {
  commitEdit();
  commitPlace();
  clearSel();
  toast('Importo ' + file.name + '…', 20000);
  let res;
  try {
    res = await convert(await readPdf(await file.arrayBuffer()));
  } catch (err) {
    toast(err instanceof PdfError
      ? 'Non riesco a leggere questo PDF (' + err.message + '). Funziona con quelli salvati dalla lavagna Microsoft.'
      : 'Questo PDF non viene dalla lavagna Microsoft o non lo so leggere.', 5000);
    return false;
  }
  const { list, skipped } = res;
  if (!list.length) { toast('Nel PDF non ho trovato tratti, testi o immagini.'); return false; }
  const wasEmpty = !S.ops.length;

  // al centro della vista, con uno zoom che lo mostra tutto
  const bb = [Infinity, Infinity, -Infinity, -Infinity];
  for (const o of list) {
    bb[0] = Math.min(bb[0], o.bb[0]); bb[1] = Math.min(bb[1], o.bb[1]);
    bb[2] = Math.max(bb[2], o.bb[2]); bb[3] = Math.max(bb[3], o.bb[3]);
  }
  const cx = (S.vw / 2 - pan.x) / S.zoom, cy = (S.vh / 2 - pan.y) / S.zoom;
  const dx = Math.round(cx - (bb[0] + bb[2]) / 2), dy = Math.round(cy - (bb[1] + bb[3]) / 2);
  const placed = list.map(o => shiftOp(o, dx, dy));
  const z = Math.max(.25, Math.min(S.zoom, .9 * S.vw / (bb[2] - bb[0]), .8 * S.vh / (bb[3] - bb[1])));

  S.ops.push(...placed);
  record({ t: 'addmany', ops: placed });
  if (z < S.zoom) setView(S.vw / 2 - cx * z, S.vh / 2 - cy * z, z);
  else for (const o of placed) forTiles(o.bb, true, t => paint(t, o));
  setTool('se');
  setSel(placed);
  if (wasEmpty) setName(baseName(file.name));
  afterChange();

  const n = k => placed.filter(o => o.k === k).length;
  const parts = [[n('sh'), 'tratti e forme'], [n('tx'), 'testi'], [n('im'), 'immagini']].filter(p => p[0]).map(p => p.join(' '));
  toast('Importati ' + parts.join(', ') + (skipped ? ` (${skipped} immagini non lette)` : '') + '. Annulla per toglierli.', 4500);
  return true;
}
