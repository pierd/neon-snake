// The deep neon void behind everything: a glowing grid floor far below,
// drifting dust for parallax, and a soft glow under the arena.
import * as THREE from "three";

function seeded(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function gridTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#01030a";
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = "rgba(0,170,255,0.35)";
  g.lineWidth = 2;
  g.strokeRect(0, 0, 128, 128);
  g.strokeStyle = "rgba(0,120,255,0.12)";
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(64, 0); g.lineTo(64, 128); g.moveTo(0, 64); g.lineTo(128, 64);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "rgba(255,255,255,0.55)");
  grad.addColorStop(0.4, "rgba(255,255,255,0.15)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export function buildBackdrop(ctx) {
  const { scene } = ctx;
  scene.background = new THREE.Color("#01030a");

  const tex = gridTexture();
  tex.repeat.set(400 / 14, 240 / 14);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 240),
    new THREE.MeshBasicMaterial({ map: tex, color: "#6fa8ff" }),
  );
  floor.name = "Backdrop Grid";
  floor.position.z = -125;
  scene.add(floor);

  const rand = seeded(1337);
  const n = 500;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (rand() - 0.5) * 240;
    pos[i * 3 + 1] = (rand() - 0.5) * 150;
    pos[i * 3 + 2] = -120 + rand() * 114;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: "#4fd8ff", size: 0.22, transparent: true, opacity: 0.7, toneMapped: false,
  }));
  dust.name = "Neon Dust";
  scene.add(dust);

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 70),
    new THREE.MeshBasicMaterial({
      map: glowTexture(), color: "#00e5ff", transparent: true, opacity: 0.35,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  glow.name = "Arena Glow";
  glow.position.z = -2;
  scene.add(glow);

  return { floor, dust, glow };
}
