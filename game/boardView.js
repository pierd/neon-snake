// Neon rendering of one board and the snake on it. Used for the main arena,
// the menu previews, and the small background maps of other players.
import * as THREE from "three";

export const PALETTES = {
  triangle: { grid: "#ff2bd6", snake: "#22f3ff" },
  square: { grid: "#00e5ff", snake: "#ff8a1f" },
  hexagon: { grid: "#8dff3a", snake: "#ff3df0" },
};
const FOOD = new THREE.Color("#ffe94d");

function addFan(arr, cell, shrink, ox = 0, oy = 0, z = 0) {
  const { cx, cy, poly } = cell;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    arr.push(
      cx - ox, cy - oy, z,
      cx + (a[0] - cx) * shrink - ox, cy + (a[1] - cy) * shrink - oy, z,
      cx + (b[0] - cx) * shrink - ox, cy + (b[1] - cy) * shrink - oy, z,
    );
  }
}

function dynMesh(capacityFloats, material, name, z) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(capacityFloats), 3));
  geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(capacityFloats), 3));
  geo.setDrawRange(0, 0);
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.name = name;
  mesh.position.z = z;
  return mesh;
}

export function createBoardView(board, opts = {}) {
  const pal = PALETTES[board.mode];
  const dim = opts.dim ?? 1;
  const gridColor = new THREE.Color(opts.gridColor ?? pal.grid);
  const snakeColor = new THREE.Color(opts.snakeColor ?? pal.snake);
  const group = new THREE.Group();
  group.name = opts.name ?? "Arena";

  // Dark floor so the backdrop doesn't show through the arena.
  const fp = [];
  for (const c of board.cells) addFan(fp, c, 1);
  const floorGeo = new THREE.BufferGeometry();
  floorGeo.setAttribute("position", new THREE.Float32BufferAttribute(fp, 3));
  const floor = new THREE.Mesh(floorGeo, new THREE.MeshBasicMaterial({
    color: gridColor.clone().multiplyScalar(0.025), transparent: true, opacity: opts.floorOpacity ?? 0.92,
    side: THREE.DoubleSide, depthWrite: false,
  }));
  floor.name = "Floor";
  group.add(floor);

  // Inner grid lines and a thick glowing border.
  const gp = [], bp = [];
  const bw = opts.borderWidth ?? 0.16;
  for (const c of board.cells)
    for (const e of c.edges) {
      if (e.neighbor < 0) {
        const nx = Math.cos(e.angle) * bw, ny = Math.sin(e.angle) * bw;
        const [ax, ay] = e.a, [bx, by] = e.b;
        bp.push(ax, ay, 0, bx, by, 0, bx + nx, by + ny, 0, ax, ay, 0, bx + nx, by + ny, 0, ax + nx, ay + ny, 0);
      } else if (c.id < e.neighbor) gp.push(e.a[0], e.a[1], 0.01, e.b[0], e.b[1], 0.01);
    }
  const gridGeo = new THREE.BufferGeometry();
  gridGeo.setAttribute("position", new THREE.Float32BufferAttribute(gp, 3));
  const grid = new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({
    color: gridColor.clone().multiplyScalar(dim), transparent: true, opacity: 0.32, toneMapped: false,
  }));
  grid.name = "Grid Lines";
  group.add(grid);
  const borderGeo = new THREE.BufferGeometry();
  borderGeo.setAttribute("position", new THREE.Float32BufferAttribute(bp, 3));
  const border = new THREE.Mesh(borderGeo, new THREE.MeshBasicMaterial({
    color: gridColor.clone().multiplyScalar(2.2 * dim), side: THREE.DoubleSide, toneMapped: false,
  }));
  border.name = "Border";
  group.add(border);

  // Snake body, head, heading chevron, trail line and food.
  const cap = board.cells.length * board.maxVerts * 9;
  const body = dynMesh(cap, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false }), "Snake Body", 0.02);
  group.add(body);
  const head = dynMesh(board.maxVerts * 9, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false }), "Snake Head", 0.03);
  group.add(head);
  const chevGeo = new THREE.BufferGeometry();
  chevGeo.setAttribute("position", new THREE.Float32BufferAttribute([0.32, 0, 0, -0.16, 0.22, 0, -0.06, 0, 0, 0.32, 0, 0, -0.06, 0, 0, -0.16, -0.22, 0], 3));
  const chevron = new THREE.Mesh(chevGeo, new THREE.MeshBasicMaterial({ color: "#04101c", side: THREE.DoubleSide }));
  chevron.name = "Heading Chevron";
  chevron.position.z = 0.05;
  group.add(chevron);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(board.cells.length * 3), 3));
  trailGeo.setDrawRange(0, 0);
  const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: snakeColor.clone().multiplyScalar(3 * dim), toneMapped: false }));
  trail.frustumCulled = false;
  trail.name = "Light Trail";
  trail.position.z = 0.04;
  group.add(trail);
  const food = dynMesh(board.maxVerts * 9, new THREE.MeshBasicMaterial({ color: FOOD.clone().multiplyScalar(2.2 * dim), side: THREE.DoubleSide, toneMapped: false }), "Energy Cell", 0.03);
  group.add(food);
  const ringGeo = new THREE.BufferGeometry();
  ringGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(board.maxVerts * 3 + 3), 3));
  const ring = new THREE.Line(ringGeo, new THREE.LineBasicMaterial({ color: FOOD.clone().multiplyScalar(2 * dim), transparent: true, toneMapped: false }));
  ring.frustumCulled = false;
  ring.name = "Energy Ring";
  ring.position.z = 0.03;
  group.add(ring);

  const tmp = new THREE.Color();
  const deadColor = new THREE.Color("#ff2040");
  let alive = true, deathT = 0, foodId = -1;

  function fill(mesh, ids, shrink, colorFor) {
    const pos = mesh.geometry.attributes.position, col = mesh.geometry.attributes.color;
    const arr = [];
    let v = 0;
    for (let k = 0; k < ids.length; k++) {
      const cell = board.cells[ids[k]];
      if (!cell) continue;
      arr.length = 0;
      addFan(arr, cell, shrink);
      const c = colorFor(k);
      for (let i = 0; i < arr.length; i += 3) {
        pos.array[v * 3] = arr[i]; pos.array[v * 3 + 1] = arr[i + 1]; pos.array[v * 3 + 2] = 0;
        col.array[v * 3] = c.r; col.array[v * 3 + 1] = c.g; col.array[v * 3 + 2] = c.b;
        v++;
      }
    }
    mesh.geometry.setDrawRange(0, v);
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }

  const view = {
    group, board,
    setSnake(ids, foodCell, isAlive = true, heading = 0) {
      if (alive && !isAlive) deathT = 0;
      alive = isAlive;
      const len = ids.length;
      fill(body, ids.slice(1), 0.82, (k) => {
        const t = len > 2 ? (k + 1) / (len - 1) : 0;
        tmp.copy(alive ? snakeColor : deadColor).multiplyScalar((1.7 - 1.15 * t) * dim);
        return tmp;
      });
      fill(head, ids.slice(0, 1), 0.9, () => tmp.copy(alive ? snakeColor : deadColor).lerp(new THREE.Color(1, 1, 1), 0.55).multiplyScalar(2.2 * dim));
      const h = board.cells[ids[0]];
      chevron.visible = !!h && alive;
      if (h) {
        chevron.position.set(h.cx, h.cy, 0.05);
        chevron.rotation.z = heading;
      }
      const tp = trailGeo.attributes.position;
      let n = 0;
      for (const id of ids) {
        const c = board.cells[id];
        if (!c) continue;
        tp.array[n * 3] = c.cx; tp.array[n * 3 + 1] = c.cy; tp.array[n * 3 + 2] = 0;
        n++;
      }
      trailGeo.setDrawRange(0, n);
      tp.needsUpdate = true;
      if (foodCell !== foodId) {
        foodId = foodCell;
        const fc = board.cells[foodCell];
        food.visible = ring.visible = !!fc;
        if (fc) {
          const arr = [];
          addFan(arr, fc, 0.7, fc.cx, fc.cy);
          food.geometry.attributes.position.array.set(arr);
          food.geometry.attributes.position.needsUpdate = true;
          food.geometry.setDrawRange(0, arr.length / 3);
          food.position.set(fc.cx, fc.cy, 0.03);
          const rp = ringGeo.attributes.position;
          fc.poly.forEach((p, i) => rp.setXYZ(i, p[0] - fc.cx, p[1] - fc.cy, 0));
          rp.setXYZ(fc.poly.length, fc.poly[0][0] - fc.cx, fc.poly[0][1] - fc.cy, 0);
          rp.needsUpdate = true;
          ringGeo.setDrawRange(0, fc.poly.length + 1);
          ring.position.set(fc.cx, fc.cy, 0.03);
        }
      }
    },
    tick(t, dt) {
      food.scale.setScalar(0.85 + 0.15 * Math.sin(t * 7));
      const p = (t * 1.2) % 1;
      ring.scale.setScalar(0.8 + p * 0.9);
      ring.material.opacity = 1 - p;
      if (!alive) {
        deathT += dt;
        const f = deathT < 1.2 ? (Math.sin(deathT * 40) > 0 ? 1 : 0.15) : Math.max(0.12, 1 - (deathT - 1.2));
        body.material.color.setScalar(f);
        head.material.color.setScalar(f);
        trail.visible = deathT < 1.2;
      } else {
        body.material.color.setScalar(1);
        head.material.color.setScalar(1);
        trail.visible = true;
      }
    },
  };
  group.userData.view = view;
  return view;
}
