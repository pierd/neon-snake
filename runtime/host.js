/**
 * Runs the game in this page: `build(ctx)`, `start(ctx)`, then
 * `update(dt, ctx)` and `render(ctx)` every frame, with the same `ctx` the
 * Nilo code-game frame gave it in Play.
 */
import * as THREE from "three";

import { GameInput } from "./input.js";
import { createNet } from "./net.js";
import { GameSpawnables } from "./spawnables.js";

const MAX_PIXEL_RATIO = 2;
/** Longest frame step, so a stalled tab does not tunnel objects. */
const MAX_FRAME_DT_SECONDS = 0.1;
const GAME_CAMERA_FOV = 70;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 5_000;

let errorOverlay = null;
let running = true;

function showError(error, phase) {
  console.error(`Game ${phase} failed`, error);
  if (errorOverlay !== null) return;
  errorOverlay = document.createElement("div");
  errorOverlay.style.cssText =
    "position:fixed;left:12px;right:12px;bottom:12px;padding:10px 12px;border-radius:8px;background:rgba(120,20,30,0.9);color:#fff;font:13px/1.4 ui-monospace,monospace;white-space:pre-wrap;pointer-events:none;";
  errorOverlay.textContent = `${phase}: ${error instanceof Error ? error.message : String(error)}`;
  document.body.appendChild(errorOverlay);
}

/** A full-size overlay for HUDs and menus; children opt into pointer events. */
function createUiRoot() {
  const ui = document.createElement("div");
  ui.id = "ui";
  ui.style.cssText =
    "position:fixed;inset:0;pointer-events:none;overflow:hidden;font-family:system-ui,sans-serif;color:#fff;";
  document.body.appendChild(ui);
  return ui;
}

function createContext(net) {
  document.documentElement.style.cssText = "height:100%;";
  document.body.style.cssText = "margin:0;height:100%;overflow:hidden;background:#0d0f14;";
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const canvas = renderer.domElement;
  canvas.style.cssText = "display:block;width:100%;height:100%;outline:none;";
  canvas.tabIndex = 0;
  document.body.appendChild(canvas);
  const camera = new THREE.PerspectiveCamera(
    GAME_CAMERA_FOV,
    window.innerWidth / Math.max(window.innerHeight, 1),
    CAMERA_NEAR,
    CAMERA_FAR
  );
  camera.position.set(0, 5, 10);
  camera.lookAt(0, 0, 0);
  const ctx = {
    THREE,
    scene: new THREE.Scene(),
    camera,
    renderer,
    canvas,
    ui: createUiRoot(),
    mode: "play",
    time: { elapsed: 0, frame: 0 },
    input: new GameInput(canvas),
    net,
    spawnables: new GameSpawnables(() => ctx),
    log: (...values) => console.info(...values),
  };
  return ctx;
}

function resize(ctx, game) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  ctx.renderer.setSize(width, height, false);
  if (ctx.camera.isPerspectiveCamera) {
    ctx.camera.aspect = width / Math.max(height, 1);
    ctx.camera.updateProjectionMatrix();
  }
  try {
    game.resize?.(width, height, ctx);
  } catch (error) {
    showError(error, "resize");
  }
}

function renderFrame(ctx, game) {
  try {
    if (game.render) game.render(ctx);
    else ctx.renderer.render(ctx.scene, ctx.camera);
  } catch (error) {
    showError(error, "render");
    running = false;
  }
}

function startLoop(ctx, game) {
  let last = performance.now();
  ctx.renderer.setAnimationLoop((time) => {
    const dt = Math.max(Math.min((time - last) / 1000, MAX_FRAME_DT_SECONDS), 0);
    last = time;
    ctx.time.elapsed += dt;
    ctx.time.frame += 1;
    try {
      game.update?.(dt, ctx);
    } catch (error) {
      showError(error, "update");
      running = false;
    } finally {
      ctx.input.endFrame();
    }
    if (running) renderFrame(ctx, game);
    if (!running) ctx.renderer.setAnimationLoop(null);
  });
}

async function main() {
  const { net, leave } = await createNet((error) => showError(error, "net"));
  const ctx = createContext(net);
  const game = await import("../main.js");
  window.addEventListener("resize", () => resize(ctx, game));
  window.addEventListener("pagehide", () => {
    running = false;
    ctx.renderer.setAnimationLoop(null);
    try {
      game.dispose?.(ctx);
    } catch (error) {
      console.warn("Game dispose failed", error);
    }
    net.dispose();
    leave();
  });
  window.addEventListener("error", (event) => showError(event.error ?? event.message, "runtime"));
  window.addEventListener("unhandledrejection", (event) => showError(event.reason, "runtime"));

  try {
    await game.build?.(ctx);
  } catch (error) {
    showError(error, "build");
    return;
  }
  try {
    await game.start?.(ctx);
  } catch (error) {
    showError(error, "start");
    renderFrame(ctx, game);
    return;
  }
  ctx.canvas.focus();
  startLoop(ctx, game);
}

main().catch((error) => showError(error, "load"));
