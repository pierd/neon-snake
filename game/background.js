// Bird's-eye view of other players' maps, floating far below the arena.
// Real players come from ctx.net state; empty slots are filled with AI demos.
import * as THREE from "three";
import { getBoard, MODES } from "./boards.js";
import { createBoardView, PALETTES } from "./boardView.js";
import { SnakeGame } from "./snake.js";

const Z = -100;
const MIN_MAPS = 10;
const AI_NAMES = ["GRID-BOT", "CLU", "SARK", "RINZLER", "BIT", "QUORRA", "RAM", "YORI"];

function labelSprite() {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 80;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  sprite.scale.set(24, 3.75, 1);
  sprite.name = "Label";
  let last = "";
  sprite.userData.set = (text, color) => {
    if (text + color === last) return;
    last = text + color;
    const g = c.getContext("2d");
    g.clearRect(0, 0, 512, 80);
    g.font = "bold 40px monospace";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.shadowColor = color;
    g.shadowBlur = 14;
    g.fillStyle = color;
    g.fillText(text, 256, 40);
    tex.needsUpdate = true;
  };
  return sprite;
}

export function createPlayerMap(mode = "square", color) {
  const board = getBoard(mode);
  const view = createBoardView(board, { name: "Player Map", dim: 0.45, snakeColor: color, borderWidth: 0.35, floorOpacity: 0.6 });
  const label = labelSprite();
  label.position.set(0, board.height / 2 + 3, 0);
  view.group.add(label);
  view.label = label;
  label.userData.set("PLAYER", color ?? PALETTES[mode].snake);
  return view;
}

export function createBackground(ctx) {
  const root = new THREE.Group();
  root.name = "Other Players";
  ctx.scene.add(root);

  const slots = [];
  for (const y of [-54, -18, 18, 54])
    for (const x of [-84, -42, 0, 42, 84]) if (x || Math.abs(y) > 20) slots.push({ x, y, used: false });
  slots.sort((a, b) => Math.hypot(a.x, a.y * 1.6) - Math.hypot(b.x, b.y * 1.6));

  const entries = new Map(); // key -> entry
  let aiCounter = 0;

  function place(key, mode, color, ai) {
    const slot = slots.find((s) => !s.used);
    if (!slot) return null;
    slot.used = true;
    const view = createPlayerMap(mode, color);
    view.group.name = ai ? "AI Map " + (aiCounter + 1) : "Player Map " + key;
    view.group.position.set(slot.x, slot.y, Z);
    view.group.scale.setScalar(0.72);
    view.group.rotation.z = (Math.random() - 0.5) * 0.12;
    root.add(view.group);
    const e = { key, mode, color, view, slot, ai, phase: Math.random() * 6 };
    entries.set(key, e);
    return e;
  }

  function remove(e) {
    root.remove(e.view.group);
    e.slot.used = false;
    entries.delete(e.key);
  }

  function addAI() {
    const mode = MODES[aiCounter % 3];
    const color = PALETTES[mode].snake;
    const e = place("ai" + aiCounter, mode, color, true);
    if (!e) return;
    e.name = AI_NAMES[aiCounter % AI_NAMES.length];
    aiCounter++;
    e.game = new SnakeGame(getBoard(mode));
    e.game.snake.length = 4;
    for (let i = 0; i < 20 + Math.random() * 60; i++) { e.game.think(); e.game.tick(); if (!e.game.alive) e.game.reset(); }
    e.timer = 0;
    e.interval = 0.09 + Math.random() * 0.05;
    e.deadT = 0;
  }

  let netTimer = 0;
  function syncNet() {
    const net = ctx.net;
    const live = new Set();
    for (const p of net.players()) {
      if (p.id === net.me.id) continue;
      const st = net.getState(p.id);
      if (!st || !st.m) continue;
      const key = "p" + p.id;
      live.add(key);
      let e = entries.get(key);
      if (e && e.mode !== st.m) { remove(e); e = null; }
      if (!e) {
        if (!slots.some((s) => !s.used)) {
          const ai = [...entries.values()].find((x) => x.ai);
          if (ai) remove(ai);
        }
        e = place(key, st.m, p.color, false);
        if (!e) continue;
      }
      e.view.setSnake(st.s || [], st.f ?? -1, st.a !== false, st.h || 0);
      const status = st.st === "menu" ? " · MENU" : st.a === false ? " · DEREZZED" : "";
      e.view.label.userData.set((p.name || "PLAYER").toUpperCase().slice(0, 14) + "  " + (st.sc || 0) + status, p.color);
    }
    for (const e of [...entries.values()]) if (!e.ai && !live.has(e.key)) remove(e);
    let total = entries.size;
    const aiList = [...entries.values()].filter((e) => e.ai);
    while (total > MIN_MAPS && aiList.length) { remove(aiList.pop()); total--; }
    while (total < MIN_MAPS) { addAI(); total++; }
  }

  return {
    root,
    update(dt, t) {
      netTimer -= dt;
      if (netTimer <= 0) { netTimer = 0.25; syncNet(); }
      for (const e of entries.values()) {
        e.view.group.position.z = Z + Math.sin(t * 0.5 + e.phase) * 0.8;
        if (e.ai) {
          const g = e.game;
          if (!g.alive) {
            e.deadT += dt;
            if (e.deadT > 2) { g.reset(); e.deadT = 0; }
          } else {
            e.timer += dt;
            while (e.timer > e.interval) {
              e.timer -= e.interval;
              g.think();
              g.tick();
            }
          }
          e.view.setSnake(g.snake, g.food, g.alive, g.heading);
          e.view.label.userData.set(e.name + "  " + g.score + " · AI", e.color);
        }
        e.view.tick(t, dt);
      }
    },
  };
}
