// Lettore PDF minimo, pensato per i PDF stampati da Chromium come quelli della lavagna Microsoft.
// Legge oggetti, dizionari e flussi; non gestisce cifratura né object stream.

export class Name { constructor(n) { this.n = n; } }

export class Ref { constructor(num) { this.num = num; } }

export class Op { constructor(op) { this.op = op; } }

export class PdfError extends Error {}

const isWhite = c => c === 32 || c === 10 || c === 13 || c === 9 || c === 12 || c === 0;

const isDelim = c => c === 40 || c === 41 || c === 60 || c === 62 || c === 91 || c === 93 || c === 123 || c === 125 || c === 47 || c === 37;

// Byte in stringa, un carattere per byte
export function latin1(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return s;
}

/* Lettura dei valori: dizionari, array, nomi, numeri, stringhe, riferimenti. Gli operatori dei content stream diventano Op */
export class Lexer {
  constructor(s, pos = 0) { this.s = s; this.pos = pos; }

  skip() {
    const s = this.s;
    for (;;) {
      const c = s.charCodeAt(this.pos);
      if (isWhite(c)) this.pos++;
      else if (c === 37) { while (this.pos < s.length && s[this.pos] !== '\n' && s[this.pos] !== '\r') this.pos++; }
      else return;
    }
  }

  word() {
    const s = this.s, start = this.pos;
    while (this.pos < s.length) {
      const c = s.charCodeAt(this.pos);
      if (isWhite(c) || isDelim(c)) break;
      this.pos++;
    }
    return s.slice(start, this.pos);
  }

  // Un valore, oppure undefined a fine testo. Con refs i "n g R" diventano Ref
  next(refs = true) {
    this.skip();
    const s = this.s;
    if (this.pos >= s.length) return undefined;
    const ch = s[this.pos];
    if (ch === '/') {
      this.pos++;
      return new Name(this.word().replace(/#([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))));
    }
    if (ch === '(') return this.literal();
    if (ch === '<') {
      if (s[this.pos + 1] === '<') {
        this.pos += 2;
        const d = {};
        for (;;) {
          this.skip();
          if (s.startsWith('>>', this.pos)) { this.pos += 2; return d; }
          const k = this.next(refs);
          if (!(k instanceof Name)) throw new PdfError('dizionario non valido');
          d[k.n] = this.next(refs);
        }
      }
      const end = s.indexOf('>', this.pos);
      const hex = s.slice(this.pos + 1, end).replace(/\s+/g, '');
      this.pos = end + 1;
      let out = '';
      for (let i = 0; i < hex.length; i += 2) out += String.fromCharCode(parseInt((hex[i] + (hex[i + 1] || '0')), 16));
      return out;
    }
    if (ch === '[') {
      this.pos++;
      const a = [];
      for (;;) {
        this.skip();
        if (s[this.pos] === ']') { this.pos++; return a; }
        if (this.pos >= s.length) throw new PdfError('array non chiuso');
        a.push(this.next(refs));
      }
    }
    if (ch === ']' || ch === '>' || ch === ')' || ch === '{' || ch === '}') { this.pos++; return new Op(ch); }
    const w = this.word();
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(w)) {
      const n = +w;
      // "n g R": riferimento a un oggetto
      if (refs && /^\d+$/.test(w)) {
        const m = /^\s+(\d+)\s+R(?=[\s/<>[\]()%]|$)/.exec(s.slice(this.pos, this.pos + 24));
        if (m) { this.pos += m[0].length; return new Ref(n); }
      }
      return n;
    }
    if (w === 'true') return true;
    if (w === 'false') return false;
    if (w === 'null') return null;
    if (!w) { this.pos++; return this.next(refs); }
    return new Op(w);
  }

  literal() {
    const s = this.s;
    let depth = 0, out = '';
    this.pos++;
    for (;;) {
      if (this.pos >= s.length) return out;
      const ch = s[this.pos++];
      if (ch === '\\') {
        const e = s[this.pos++];
        const map = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' };
        if (map[e]) out += map[e];
        else if (e >= '0' && e <= '7') {
          let o = e;
          while (o.length < 3 && s[this.pos] >= '0' && s[this.pos] <= '7') o += s[this.pos++];
          out += String.fromCharCode(parseInt(o, 8) & 255);
        } else if (e === '\r') { if (s[this.pos] === '\n') this.pos++; }
        else if (e !== '\n') out += e;
      } else if (ch === '(') { depth++; out += ch; }
      else if (ch === ')') { if (!depth) return out; depth--; out += ch; }
      else out += ch;
    }
  }
}

async function inflate(u8) {
  const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Predittori PNG (Predictor >= 10) applicati dopo FlateDecode
function unpredict(u8, p) {
  const pred = p?.Predictor || 1;
  if (pred < 10) return u8;
  const colors = p.Colors || 1, bpc = p.BitsPerComponent || 8, cols = p.Columns || 1;
  const bpp = Math.max(1, Math.ceil(colors * bpc / 8)), row = Math.ceil(colors * bpc * cols / 8);
  const out = new Uint8Array(Math.floor(u8.length / (row + 1)) * row);
  let prev = new Uint8Array(row);
  for (let r = 0, i = 0; i + row < u8.length + 1 && r * row < out.length; r++) {
    const type = u8[i++], cur = out.subarray(r * row, r * row + row);
    for (let x = 0; x < row; x++) {
      const raw = u8[i++], a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = raw;
      if (type === 1) v += a;
      else if (type === 2) v += b;
      else if (type === 3) v += (a + b) >> 1;
      else if (type === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 255;
    }
    prev = cur;
  }
  return out;
}

export class Pdf {
  constructor(bytes) {
    this.bytes = bytes;
    this.s = latin1(bytes);
    this.objs = new Map();
    if (/\/Encrypt\b/.test(this.s.slice(-4096)) || /trailer[\s\S]{0,400}\/Encrypt\b/.test(this.s)) throw new PdfError('PDF protetto');
    const re = /(?:^|[\s>\]])(\d+)\s+\d+\s+obj\b/g;
    let m;
    while ((m = re.exec(this.s))) {
      const lx = new Lexer(this.s, re.lastIndex);
      let val;
      try { val = lx.next(); } catch { continue; }
      const obj = { val, stream: null };
      lx.skip();
      if (this.s.startsWith('stream', lx.pos)) {
        let p = lx.pos + 6;
        if (this.s[p] === '\r') p++;
        if (this.s[p] === '\n') p++;
        obj.stream = p;
      }
      this.objs.set(+m[1], obj);
      // i dati del flusso si saltano: dentro potrebbero esserci byte che sembrano "obj"
      if (obj.stream != null) {
        const len = val?.Length;
        const end = typeof len === 'number' ? obj.stream + len : this.s.indexOf('endstream', obj.stream);
        re.lastIndex = end > 0 ? end : obj.stream;
      } else re.lastIndex = lx.pos;
    }
    if (!this.objs.size) throw new PdfError('nessun oggetto');
  }

  get(v) {
    for (let i = 0; v instanceof Ref && i < 32; i++) v = this.objs.get(v.num)?.val;
    return v instanceof Ref ? undefined : v;
  }

  name(v) { v = this.get(v); return v instanceof Name ? v.n : undefined; }

  // Byte grezzi di un flusso, dato il riferimento
  raw(ref) {
    const o = ref instanceof Ref ? this.objs.get(ref.num) : null;
    if (!o?.stream) return null;
    const d = o.val;
    let len = this.get(d.Length);
    if (typeof len !== 'number' || o.stream + len > this.bytes.length) {
      const end = this.s.indexOf('endstream', o.stream);
      len = Math.max(0, end - o.stream);
      while (len && (this.s[o.stream + len - 1] === '\n' || this.s[o.stream + len - 1] === '\r')) len--;
    }
    return { dict: d, bytes: this.bytes.subarray(o.stream, o.stream + len) };
  }

  // Dati decodificati. I JPEG (DCTDecode) restano compressi, segnalati da jpeg: true
  async data(ref) {
    const r = this.raw(ref);
    if (!r) throw new PdfError('flusso mancante');
    let filters = this.get(r.dict.Filter), parms = this.get(r.dict.DecodeParms);
    filters = filters == null ? [] : Array.isArray(filters) ? filters.map(f => this.name(f)) : [this.name(filters)];
    parms = Array.isArray(parms) ? parms.map(p => this.get(p)) : [parms];
    let u8 = r.bytes;
    for (let i = 0; i < filters.length; i++) {
      const f = filters[i];
      if (f === 'FlateDecode' || f === 'Fl') u8 = unpredict(await inflate(u8), this.get(parms[i]));
      else if (f === 'DCTDecode' || f === 'DCT') return { dict: r.dict, bytes: u8, jpeg: true };
      else throw new PdfError('filtro non supportato: ' + f);
    }
    return { dict: r.dict, bytes: u8, jpeg: false };
  }

  // Pagine in ordine, con risorse e MediaBox ereditate
  pages() {
    let root = null;
    const tr = /trailer\s*<</g;
    let m;
    while ((m = tr.exec(this.s))) {
      const d = new Lexer(this.s, m.index + 7).next();
      if (d?.Root) root = this.get(d.Root);
    }
    if (!root) for (const o of this.objs.values()) if (this.name(o.val?.Type) === 'Catalog') root = o.val;
    if (!root) throw new PdfError('catalogo mancante');
    const out = [];
    const walk = (node, inh, depth) => {
      node = this.get(node);
      if (!node || depth > 32) return;
      const h = { Resources: node.Resources ?? inh.Resources, MediaBox: node.MediaBox ?? inh.MediaBox };
      if (this.name(node.Type) === 'Pages' || node.Kids) for (const k of this.get(node.Kids) || []) walk(k, h, depth + 1);
      else out.push({ ...node, Resources: this.get(h.Resources) || {}, MediaBox: (this.get(h.MediaBox) || [0, 0, 612, 792]).map(v => this.get(v)) });
    };
    walk(root.Pages, {}, 0);
    if (!out.length) throw new PdfError('nessuna pagina');
    return out;
  }

  // Testo del content stream di una pagina o di un Form
  async content(c) {
    c = c instanceof Ref ? [c] : this.get(c);
    if (!Array.isArray(c)) c = c ? [c] : [];
    const parts = [];
    for (const r of c) parts.push(latin1((await this.data(r)).bytes));
    return parts.join('\n');
  }
}

export async function readPdf(buf) {
  const bytes = new Uint8Array(buf);
  if (latin1(bytes.subarray(0, 1024)).indexOf('%PDF') < 0) throw new PdfError('non è un PDF');
  return new Pdf(bytes);
}
