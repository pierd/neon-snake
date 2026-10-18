import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { buildBackdrop } from "./world/backdrop.js";
import { getBoard, MODES } from "./game/boards.js";
import { createBoardView, PALETTES } from "./game/boardView.js";
import { createBackground, createPlayerMap } from "./game/background.js";
import { SnakeGame } from "./game/snake.js";
import { createHud } from "./game/hud.js";
import { sfx, unlockAudio } from "./game/audio.js";
import { music } from "./game/music.js";

const PREVIEW_SCALE = 0.62;
let world, select, previews = [];
let state = "menu", mode = "square", game, arena, arenas = {};
let hud, bg, composer, bloom, cam;
let tickTimer = 0, shake = 0, overT = 0, hoverMode = null;
const bursts = [];
const best = { triangle: 0, square: 0, hexagon: 0 };

// Touch controls: always on for touch-first devices, opt-in on desktop
// (not persisted). Touch devices are asked to play in landscape.
const touchDevice = matchMedia("(hover: none) and (pointer: coarse)").matches;
const landscapeQuery = matchMedia("(orientation: landscape)");
let touchToggle = false;
const touchOn = () => touchDevice || touchToggle;
const needsRotate = () => touchDevice && !landscapeQuery.matches;

function makeBurst(c, p = {}) {
  const n = 28;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    color: new THREE.Color(p.color ?? "#ffe94d").multiplyScalar(2.5), size: 0.35, transparent: true, toneMapped: false,
  }));
  pts.frustumCulled = false;
  pts.userData.vel = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.3, s = 4 + Math.random() * 7;
    return [Math.cos(a) * s, Math.sin(a) * s];
  });
  return pts;
}

export function build(ctx) {
  world = buildBackdrop(ctx);
  ctx.spawnables.define("arena", (c, p = {}) => createBoardView(getBoard(p.mode ?? "square"), { name: "Arena" }).group, {
    description: "A playable neon board (triangle, square or hexagon) with its snake and energy cell.",
  });
  ctx.spawnables.define("player-map", (c, p = {}) => createPlayerMap(p.mode ?? "hexagon", p.color).group, {
    description: "Another player's (or an AI demo's) map, shown small in the background with a name label.",
  });
  ctx.spawnables.define("eat-burst", makeBurst, { description: "Spark burst when the snake eats an energy cell." });

  select = new THREE.Group();
  select.name = "Mode Select";
  previews = MODES.map((m, i) => {
    const g = ctx.spawnables.spawn("arena", { mode: m });
    g.name = "Preview " + m;
    g.position.set((i - 1) * 17, 0, 0);
    g.scale.setScalar(PREVIEW_SCALE);
    select.add(g);
    return { mode: m, group: g, view: g.userData.view, game: null, timer: 0 };
  });
  ctx.scene.add(select);
}

function fitCamera(ctx) {
  const aspect = ctx.renderer.domElement.clientWidth / Math.max(1, ctx.renderer.domElement.clientHeight) || 16 / 9;
  cam.aspect = aspect;
  cam.updateProjectionMatrix();
  const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
  const needW = state === "menu" ? 54 : 26, needH = state === "menu" ? 30 : 27;
  return Math.max(needH / 2 / tanH, needW / 2 / (tanH * aspect));
}

function setState(ctx, s) {
  state = s;
  select.visible = s === "menu";
  hoverMode = null;
  hud.highlight(null);
  if (s !== "menu") ctx.renderer.domElement.style.cursor = "";
  for (const m of MODES) arenas[m].group.visible = s !== "menu" && m === mode;
  hud.show(s, mode);
  music.setMode(s);
  world.glow.material.color.set(s === "menu" ? "#00a0ff" : PALETTES[mode].grid);
  publish(ctx);
}

function startGame(ctx, m) {
  unlockAudio();
  sfx.select();
  mode = m;
  game = new SnakeGame(getBoard(m));
  game.best = best[m];
  tickTimer = 0;
  setState(ctx, "play");
  arenas[m].setSnake(game.snake, game.food, true, game.heading);
  // Started in portrait: hold the run until the device is turned.
  if (needsRotate()) setState(ctx, "pause");
}

function pauseGame(ctx) {
  if (state !== "play") return;
  sfx.select();
  setState(ctx, "pause");
}

function resumeGame(ctx) {
  if (state !== "pause" || needsRotate()) return;
  sfx.select();
  setState(ctx, "play");
}

function syncTouch(ctx) {
  hud.setTouch({ enabled: touchOn(), device: touchDevice, landscape: landscapeQuery.matches });
  if (needsRotate() && state === "play") setState(ctx, "pause");
}

function publish(ctx) {
  if (state === "menu" || !game) {
    ctx.net.setState({ st: "menu" });
    return;
  }
  ctx.net.setState({ st: state, m: mode, s: game.snake, f: game.food, a: game.alive, h: Math.round(game.heading * 100) / 100, sc: game.score });
}

export function start(ctx) {
  cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 500);
  cam.position.set(0, 0, 34);
  ctx.camera = cam;
  ctx.renderer.toneMapping = THREE.ACESFilmicToneMapping;

  for (const m of MODES) {
    const g = ctx.spawnables.spawn("arena", { mode: m });
    g.name = "Arena " + m;
    g.visible = false;
    ctx.scene.add(g);
    arenas[m] = g.userData.view;
  }
  for (const p of previews) p.game = new SnakeGame(getBoard(p.mode));

  bg = createBackground(ctx);
  hud = createHud(ctx, {
    palettes: PALETTES,
    onPick: (m) => startGame(ctx, m),
    onRetry: () => state === "over" && startGame(ctx, mode),
    onMenu: () => { sfx.select(); setState(ctx, "menu"); },
    onHover: (m) => { hoverMode = m; hud.highlight(m); sfx.hover(); },
    onTurn: (dir) => { if (state === "play" && game.turn(dir)) sfx.turn(); },
    onPause: () => pauseGame(ctx),
    onResume: () => resumeGame(ctx),
    onToggleTouch: () => {
      touchToggle = !touchToggle;
      sfx.select();
      syncTouch(ctx);
      hud.toast("TOUCH CONTROLS " + (touchToggle ? "ON" : "OFF"));
    },
  });
  syncTouch(ctx);
  bindPreviewClicks(ctx);
  landscapeQuery.addEventListener("change", () => syncTouch(ctx));

  const size = new THREE.Vector2();
  ctx.renderer.getSize(size);
  composer = new EffectComposer(ctx.renderer);
  composer.setPixelRatio(ctx.renderer.getPixelRatio());
  composer.setSize(size.x, size.y);
  composer.addPass(new RenderPass(ctx.scene, cam));
  bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), bloomLevel(), 0.45, 0.15);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  setState(ctx, "menu");

  // Browsers only allow audio after a user gesture: start the music on the first one.
  const wake = () => {
    if (!unlockAudio()) return;
    music.start();
    window.removeEventListener("pointerdown", wake);
    window.removeEventListener("keydown", wake);
  };
  window.addEventListener("pointerdown", wake);
  window.addEventListener("keydown", wake);
}

export function dispose() {
  music.stop();
}

// Bloom strength the player can adjust with [ and ] (or - and =).
let bloomStrength = 0.55;
function bloomLevel() {
  const saved = parseFloat(localStorage.getItem("neonSnakeBloom"));
  if (!Number.isNaN(saved)) bloomStrength = saved;
  return bloomStrength;
}
function adjustBloom(delta) {
  bloomStrength = Math.round(THREE.MathUtils.clamp(bloomStrength + delta, 0, 2) * 100) / 100;
  bloom.strength = bloomStrength;
  localStorage.setItem("neonSnakeBloom", String(bloomStrength));
  hud.toast("GLOW " + Math.round(bloomStrength * 100) + "%");
}

function handleInput(ctx) {
  const inp = ctx.input;
  if (inp.wasPressed("BracketLeft") || inp.wasPressed("Minus")) adjustBloom(-0.1);
  if (inp.wasPressed("BracketRight") || inp.wasPressed("Equal")) adjustBloom(0.1);
  if (inp.wasPressed("KeyM")) hud.toast(music.toggleMute() ? "MUSIC OFF" : "MUSIC ON");
  if (state === "menu") {
    MODES.forEach((m, i) => { if (inp.wasPressed("Digit" + (i + 1))) startGame(ctx, m); });
    return;
  }
  if (inp.wasPressed("Escape")) { sfx.select(); setState(ctx, "menu"); return; }
  if (state === "pause") {
    if (inp.wasPressed("Space") || inp.wasPressed("Enter")) resumeGame(ctx);
    return;
  }
  if (state === "over") {
    if (overT > 0.4 && (inp.wasPressed("Space") || inp.wasPressed("Enter"))) startGame(ctx, mode);
    return;
  }
  let turned = false;
  if (mode === "square") {
    if (inp.wasPressed("ArrowUp") || inp.wasPressed("KeyW")) turned = game.steer(Math.PI / 2) || turned;
    if (inp.wasPressed("ArrowDown") || inp.wasPressed("KeyS")) turned = game.steer(Math.PI * 1.5) || turned;
    if (inp.wasPressed("ArrowLeft") || inp.wasPressed("KeyA")) turned = game.steer(Math.PI) || turned;
    if (inp.wasPressed("ArrowRight") || inp.wasPressed("KeyD")) turned = game.steer(0) || turned;
  } else {
    if (inp.wasPressed("ArrowLeft") || inp.wasPressed("KeyA")) turned = game.turn(1) || turned;
    if (inp.wasPressed("ArrowRight") || inp.wasPressed("KeyD")) turned = game.turn(-1) || turned;
    if (mode === "hexagon") {
      // Sharp 120° turns.
      if (inp.wasPressed("KeyZ")) turned = game.turn(2) || turned;
      if (inp.wasPressed("KeyC")) turned = game.turn(-2) || turned;
    }
  }
  if (turned) sfx.turn();
}

function spawnBurst(ctx, x, y, color) {
  const b = ctx.spawnables.spawn("eat-burst", { color });
  b.position.set(x, y, 0.2);
  b.userData.t = 0;
  ctx.scene.add(b);
  bursts.push(b);
}

export function update(dt, ctx) {
  const t = ctx.time.elapsed;
  handleInput(ctx);

  if (state === "play") {
    tickTimer += dt;
    const interval = Math.max(0.055, 0.135 - game.eaten * 0.0028);
    while (tickTimer >= interval && game.alive) {
      tickTimer -= interval;
      const ev = game.tick();
      if (ev === "eat") {
        sfx.eat();
        const c = getBoard(mode).cells[game.snake[0]];
        spawnBurst(ctx, c.cx, c.cy);
        shake = Math.max(shake, 0.15);
      } else if (ev === "wall" || ev === "self") {
        sfx.die();
        shake = 1;
        best[mode] = Math.max(best[mode], game.score);
        hud.setFinal(game.score, best[mode]);
        overT = 0;
        setState(ctx, "over");
      }
      arenas[mode].setSnake(game.snake, game.food, game.alive, game.heading);
      publish(ctx);
    }
  }
  if (state === "over") overT += dt;
  if (game) music.setIntensity(game.eaten / 25);
  if (game && state !== "menu") {
    const others = ctx.net.players().length - 1;
    hud.setScore(game.score, game.snake.length, Math.max(best[mode], game.score), others);
    arenas[mode].tick(t, dt);
  }

  // Menu previews play themselves.
  if (state === "menu") {
    for (const p of previews) {
      const g = p.game;
      p.timer += dt;
      while (p.timer > 0.11) {
        p.timer -= 0.11;
        if (!g.alive) g.reset();
        g.think();
        g.tick();
      }
      p.view.setSnake(g.snake, g.food, g.alive, g.heading);
      p.view.tick(t, dt);
      const target = hoverMode === p.mode ? PREVIEW_SCALE * 1.07 : PREVIEW_SCALE;
      p.group.scale.setScalar(THREE.MathUtils.lerp(p.group.scale.x, target, 1 - Math.exp(-10 * dt)));
    }
  }

  bg.update(dt, t);

  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    b.userData.t += dt;
    const pos = b.geometry.attributes.position;
    b.userData.vel.forEach((v, k) => {
      pos.setXYZ(k, v[0] * b.userData.t * (1 - b.userData.t), v[1] * b.userData.t * (1 - b.userData.t), 0);
    });
    pos.needsUpdate = true;
    b.material.opacity = 1 - b.userData.t / 0.6;
    if (b.userData.t > 0.6) {
      ctx.scene.remove(b);
      b.geometry.dispose();
      bursts.splice(i, 1);
    }
  }

  // Camera: gentle parallax over the background maps, plus shake.
  const z = fitCamera(ctx);
  const k = 1 - Math.exp(-4 * dt);
  // No parallax with touch controls: taps would jerk the camera around.
  const par = touchOn() ? 0 : 1;
  const px = ctx.input.pointer.x * 2.5 * par, py = ctx.input.pointer.y * 1.5 * par;
  cam.position.x += (px - cam.position.x) * k;
  cam.position.y += (py - cam.position.y) * k;
  cam.position.z += (z - cam.position.z) * k;
  shake = Math.max(0, shake - dt * 2.2);
  const s = shake * shake * 0.8;
  cam.lookAt(0, 0, -4);
  cam.position.x += (Math.random() - 0.5) * s;
  cam.position.y += (Math.random() - 0.5) * s;

  // Keep menu buttons under their previews, and track each preview's
  // on-screen rectangle so the board itself can be clicked.
  if (state === "menu") {
    const v = new THREE.Vector3();
    const w = ctx.renderer.domElement.clientWidth, h = ctx.renderer.domElement.clientHeight;
    const toScreen = (x, y) => (v.set(x, y, 0).project(cam), [(v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h]);
    for (const p of previews) {
      const board = getBoard(p.mode);
      const [bx, by] = toScreen(p.group.position.x, -(board.height * PREVIEW_SCALE) / 2 - 1.2);
      hud.placeButton(p.mode, bx, by);
      const hw = (board.width * PREVIEW_SCALE) / 2, hh = (board.height * PREVIEW_SCALE) / 2;
      const [x0, y0] = toScreen(p.group.position.x - hw, hh);
      const [x1, y1] = toScreen(p.group.position.x + hw, -hh);
      p.rect = { x0, y0, x1, y1 };
    }
  }
}

function previewAt(event) {
  const r = event.currentTarget.getBoundingClientRect();
  const x = event.clientX - r.left, y = event.clientY - r.top;
  const p = previews.find((q) => q.rect && x >= q.rect.x0 && x <= q.rect.x1 && y >= q.rect.y0 && y <= q.rect.y1);
  return p ? p.mode : null;
}

function bindPreviewClicks(ctx) {
  const canvas = ctx.renderer.domElement;
  canvas.addEventListener("click", (e) => {
    if (state !== "menu") return;
    const m = previewAt(e);
    if (m) startGame(ctx, m);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (state !== "menu" || e.pointerType === "touch") return;
    const m = previewAt(e);
    canvas.style.cursor = m ? "pointer" : "";
    if (m !== hoverMode) {
      hoverMode = m;
      hud.highlight(m);
      if (m) sfx.hover();
    }
  });
}

export function render(ctx) {
  if (composer) composer.render();
  else ctx.renderer.render(ctx.scene, ctx.camera);
}

export function resize(width, height) {
  if (composer) composer.setSize(width, height);
  if (bloom) bloom.resolution.set(width, height);
}
