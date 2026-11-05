// Geometria del tratto: curve tra i punti medi. Stesso codice dal vivo e in ridisegno.

/* Forme importate da PDF: contorni esatti, terne x, y, segno (1 inizio, 2 chiusura) */
const shapePaths = new WeakMap();

export function shapePath(op) {
  let path = shapePaths.get(op);
  if (path) return path;
  path = new Path2D();
  const a = op.p;
  for (let i = 0; i < a.length; i += 3) {
    if (a[i + 2] === 1) path.moveTo(a[i], a[i + 1]);
    else path.lineTo(a[i], a[i + 1]);
    if (a[i + 2] === 2) path.closePath();
  }
  shapePaths.set(op, path);
  return path;
}

const CAPS = ['butt', 'round', 'square'], JOINS = ['miter', 'round', 'bevel'];

export function drawShape(ctx, op) {
  const path = shapePath(op);
  ctx.save();
  if (op.a != null) ctx.globalAlpha = op.a;
  if (op.mul) ctx.globalCompositeOperation = 'multiply';
  if (op.c) { ctx.fillStyle = op.c; ctx.fill(path, op.fr || 'nonzero'); }
  if (op.sc) {
    ctx.strokeStyle = op.sc;
    ctx.lineWidth = op.sw;
    ctx.lineCap = CAPS[op.lc || 0];
    ctx.lineJoin = JOINS[op.lj || 0];
    ctx.stroke(path);
  }
  ctx.restore();
}

export function styleCtx(ctx, op) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = ctx.fillStyle = op.k === 'er' ? '#000' : op.c;
}

export function drawDot(ctx, a) {
  ctx.beginPath();
  ctx.arc(a[0], a[1], a[2] / 2, 0, 6.2832);
  ctx.fill();
}

export function drawSeg(ctx, a, i) {
  const j = i * 3;
  const px = a[j - 3], py = a[j - 2], pw = a[j - 1], nx = a[j], ny = a[j + 1], nw = a[j + 2];
  const ex = (px + nx) / 2, ey = (py + ny) / 2, ew = (pw + nw) / 2;
  let sx = px, sy = py, sw = pw;
  if (i > 1) { sx = (a[j - 6] + px) / 2; sy = (a[j - 5] + py) / 2; sw = (a[j - 4] + pw) / 2; }
  if (Math.abs(ew - sw) < .04) {
    ctx.lineWidth = (sw + ew) / 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(px, py, ex, ey);
    ctx.stroke();
    return;
  }
  const len = Math.hypot(px - sx, py - sy) + Math.hypot(ex - px, ey - py);
  const steps = Math.max(2, Math.min(12, Math.ceil(len / 2.5)));
  let lx = sx, ly = sy;
  for (let k = 1; k <= steps; k++) {
    const t = k / steps, m = 1 - t;
    const x = m * m * sx + 2 * m * t * px + t * t * ex;
    const y = m * m * sy + 2 * m * t * py + t * t * ey;
    ctx.lineWidth = sw + (ew - sw) * t;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(x, y);
    ctx.stroke();
    lx = x; ly = y;
  }
}

export function drawTail(ctx, a) {
  const n = a.length / 3 - 1;
  if (n < 1) return;
  const j = n * 3;
  const mx = (a[j - 3] + a[j]) / 2, my = (a[j - 2] + a[j + 1]) / 2;
  ctx.lineWidth = a[j + 2];
  ctx.beginPath();
  ctx.moveTo(mx, my);
  ctx.lineTo(a[j], a[j + 1]);
  ctx.stroke();
}

export function drawStroke(ctx, op, clipBB) {
  styleCtx(ctx, op);
  const a = op.p, n = a.length / 3;
  drawDot(ctx, a);
  for (let i = 1; i < n; i++) {
    if (clipBB) {
      const j = i * 3, r = Math.max(a[j + 2], a[j - 1]) / 2 + 2;
      const x0 = a[j - 3], y0 = a[j - 2], x1 = a[j], y1 = a[j + 1];
      // il segmento può arrivare fino al punto medio precedente: margine di un passo
      const px = i > 1 ? a[j - 6] : x0, py = i > 1 ? a[j - 5] : y0;
      const l = Math.min(x0, x1, px) - r, h = Math.max(x0, x1, px) + r;
      const t = Math.min(y0, y1, py) - r, b = Math.max(y0, y1, py) + r;
      if (l > clipBB[2] || h < clipBB[0] || t > clipBB[3] || b < clipBB[1]) continue;
    }
    drawSeg(ctx, a, i);
  }
  drawTail(ctx, a);
}
