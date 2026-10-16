// Board geometry for the three modes. Every board is a list of polygon cells
// with edge adjacency; the snake moves by leaving its cell through the edge
// whose outward direction best matches its heading.
const SQ3 = Math.sqrt(3);
const TAU = Math.PI * 2;

export const MODES = ["triangle", "square", "hexagon"];

export function normAngle(a) {
  a %= TAU;
  return a < 0 ? a + TAU : a;
}

export function angDiff(a, b) {
  const d = normAngle(a - b);
  return d > Math.PI ? TAU - d : d;
}

function edgeKey(x, y) {
  return Math.round(x * 1000) + "," + Math.round(y * 1000);
}

// Drops dead-end cells (fewer than 2 open edges), which a snake could enter
// but never leave, then builds the board from what remains.
function finalize(mode, polys, headingStep) {
  for (;;) {
    const b = buildBoard(mode, polys, headingStep);
    const keep = b.cells.filter((c) => c.edges.filter((e) => e.neighbor >= 0).length >= 2);
    if (keep.length === b.cells.length) return b;
    const ids = new Set(keep.map((c) => c.id));
    polys = polys.filter((_, i) => ids.has(i));
  }
}

function buildBoard(mode, polys, headingStep) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of polys)
    for (const [x, y] of p) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  const ox = (minX + maxX) / 2, oy = (minY + maxY) / 2;
  const cells = polys.map((p, id) => {
    const poly = p.map(([x, y]) => [x - ox, y - oy]);
    let cx = 0, cy = 0;
    for (const v of poly) { cx += v[0]; cy += v[1]; }
    cx /= poly.length; cy /= poly.length;
    return { id, poly, cx, cy, edges: [] };
  });
  const map = new Map();
  let maxVerts = 0;
  for (const c of cells) {
    const n = c.poly.length;
    maxVerts = Math.max(maxVerts, n);
    for (let i = 0; i < n; i++) {
      const a = c.poly[i], b = c.poly[(i + 1) % n];
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const e = { a, b, angle: Math.atan2(my - c.cy, mx - c.cx), neighbor: -1 };
      c.edges.push(e);
      const ka = edgeKey(a[0], a[1]), kb = edgeKey(b[0], b[1]);
      const k = ka < kb ? ka + "|" + kb : kb + "|" + ka;
      const other = map.get(k);
      if (other) {
        other[1].neighbor = c.id;
        e.neighbor = other[0].id;
      } else map.set(k, [c, e]);
    }
  }
  let center = 0, best = Infinity;
  for (const c of cells) {
    const d = c.cx * c.cx + c.cy * c.cy - c.cx * 0.001;
    if (d < best) { best = d; center = c.id; }
  }
  return {
    mode, cells, headingStep, center, maxVerts,
    width: maxX - minX, height: maxY - minY,
  };
}

function squareBoard() {
  const N = 21, s = 1.05, polys = [];
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const x = i * s, y = j * s;
      polys.push([[x, y], [x + s, y], [x + s, y + s], [x, y + s]]);
    }
  return finalize("square", polys, Math.PI / 2);
}

function triangleBoard() {
  const W = 31, H = 17, a = 1.45, h = (a * SQ3) / 2, polys = [];
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const x0 = (i * a) / 2, y0 = j * h;
      if ((i + j) % 2 === 0) polys.push([[x0, y0], [x0 + a, y0], [x0 + a / 2, y0 + h]]);
      else polys.push([[x0, y0 + h], [x0 + a / 2, y0], [x0 + a, y0 + h]]);
    }
  return finalize("triangle", polys, Math.PI / 3);
}

function hexBoard() {
  const R = 10, size = 0.62, polys = [];
  for (let r = -R; r <= R; r++)
    for (let q = -R; q <= R; q++) {
      if (Math.abs(q + r) > R) continue;
      const cx = size * SQ3 * (q + r / 2), cy = size * 1.5 * r;
      const p = [];
      for (let k = 0; k < 6; k++) {
        const ang = Math.PI / 6 + (k * Math.PI) / 3;
        p.push([cx + size * Math.cos(ang), cy + size * Math.sin(ang)]);
      }
      polys.push(p);
    }
  return finalize("hexagon", polys, Math.PI / 3);
}

const cache = {};
export function getBoard(mode) {
  if (!cache[mode])
    cache[mode] = mode === "triangle" ? triangleBoard() : mode === "hexagon" ? hexBoard() : squareBoard();
  return cache[mode];
}

// The cell entered when leaving `id` with `heading`; -1 means a wall.
export function nextCell(board, id, heading) {
  const cell = board.cells[id];
  let best = null, bd = Infinity;
  for (const e of cell.edges) {
    const d = angDiff(e.angle, heading);
    if (d < bd - 1e-6) { bd = d; best = e; }
  }
  return best ? best.neighbor : -1;
}
