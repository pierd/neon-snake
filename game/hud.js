// HTML overlay: title menu with the three modes, in-game HUD, touch controls,
// pause and game-over panels.
const CSS = `
.nz{position:absolute;inset:0;font-family:"Courier New",ui-monospace,monospace;color:#bff6ff;user-select:none}
.nz .title{position:absolute;top:7%;width:100%;text-align:center;font-size:clamp(34px,6vw,76px);font-weight:900;letter-spacing:.35em;
 color:#e8fdff;text-shadow:0 0 8px #00e5ff,0 0 24px #00e5ff,0 0 60px #0088ff}
.nz .sub{position:absolute;top:calc(7% + clamp(46px,8vw,96px));width:100%;text-align:center;letter-spacing:.5em;font-size:13px;color:#7fdcff;opacity:.85}
.nz .btn{position:absolute;transform:translate(-50%,0);pointer-events:auto;cursor:pointer;background:rgba(0,10,20,.65);
 border:2px solid var(--c);color:var(--c);padding:10px 26px;font:900 18px "Courier New",monospace;letter-spacing:.3em;
 box-shadow:0 0 12px var(--c),inset 0 0 12px var(--c);text-shadow:0 0 8px var(--c);transition:transform .12s,background .12s}
.nz .btn:hover,.nz .btn.hl{background:var(--c);color:#02060c;transform:translate(-50%,0) scale(1.08)}
.nz .btn small{display:block;font-size:10px;letter-spacing:.2em;opacity:.8;margin-top:3px}
.nz .hud{position:absolute;top:18px;left:24px;font-size:15px;letter-spacing:.2em;text-shadow:0 0 8px var(--c)}
.nz .hud b{font-size:34px;color:#fff;display:block;text-shadow:0 0 10px var(--c),0 0 24px var(--c)}
.nz .hudr{position:absolute;top:18px;right:24px;text-align:right;font-size:13px;letter-spacing:.2em;opacity:.85}
.nz .hint{position:absolute;bottom:16px;width:100%;text-align:center;font-size:12px;letter-spacing:.25em;opacity:.7}
.nz .over{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(10,0,4,.35)}
.nz .over h1{margin:0;font-size:clamp(36px,7vw,80px);letter-spacing:.3em;color:#ffd0d8;text-shadow:0 0 10px #ff2040,0 0 40px #ff2040}
.nz .over p{letter-spacing:.3em;margin:10px 0 26px}
.nz .over .row{display:flex;gap:20px}
.nz .over .btn{position:static;transform:none}
.nz .over .btn:hover{transform:scale(1.08)}
.nz .toast{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:22px;letter-spacing:.3em;color:#fff;
 background:rgba(0,10,20,.7);border:1px solid #7fdcff;padding:10px 22px;text-shadow:0 0 10px #00e5ff;transition:opacity .4s;opacity:0}
.nz .glowhint{position:absolute;bottom:16px;right:20px;font-size:10px;letter-spacing:.2em;opacity:.5}
.nz .over.pause{background:rgba(0,6,14,.45)}
.nz .over.pause h1{color:#e8fdff;text-shadow:0 0 10px var(--c),0 0 40px var(--c)}
.nz.tdev .over .btn small{display:none}
.nz .tbtn{bottom:44px;top:auto;left:50%;padding:6px 16px;font-size:11px;letter-spacing:.25em;border-width:1px;--c:#7fdcff;
 box-shadow:0 0 6px var(--c),inset 0 0 6px var(--c);opacity:.75}
.nz .tbtn.on{opacity:1}
.nz .rothint{position:absolute;bottom:44px;width:100%;text-align:center;font-size:11px;letter-spacing:.25em;color:#7fdcff;opacity:.8}
.nz .touch{position:absolute;inset:0}
.nz .tz{position:absolute;top:0;bottom:0;pointer-events:auto;touch-action:none;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none}
.nz .tz.l{left:0;width:18%}
.nz .tz.r{right:0;width:18%}
.nz .tz.c{left:18%;right:18%}
.nz .tb{position:absolute;left:0;right:0;display:flex;align-items:center;justify-content:center;color:var(--c);
 transition:background .35s,box-shadow .35s}
.nz .tb svg{opacity:.3;transition:opacity .35s,filter .35s}
.nz .tz.l .tb{border-right:1px solid color-mix(in srgb,var(--c) 28%,transparent)}
.nz .tz.r .tb{border-left:1px solid color-mix(in srgb,var(--c) 28%,transparent)}
.nz .tb.split{border-bottom:1px solid color-mix(in srgb,var(--c) 16%,transparent)}
.nz .tb.hit{background:color-mix(in srgb,var(--c) 12%,transparent);transition:none}
.nz .tb.hit svg{opacity:.85;filter:drop-shadow(0 0 6px var(--c));transition:none}
.nz .rot{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;
 background:rgba(0,4,10,.92);pointer-events:auto;font-size:18px;letter-spacing:.3em;text-align:center;text-shadow:0 0 10px #00e5ff}
.nz .rot svg{animation:nzrot 2.4s ease-in-out infinite;filter:drop-shadow(0 0 8px #00e5ff)}
@keyframes nzrot{0%,20%{transform:rotate(0)}50%,80%{transform:rotate(-90deg)}100%{transform:rotate(0)}}
`;

// Chevron pointing left (dir 1) or right (dir -1); doubled for sharp turns.
function chevron(dir, sharp) {
  const flip = dir < 0 ? ' transform="scale(-1,1) translate(-36,0)"' : "";
  const one = (x) => `<polyline points="${x + 10},6 ${x},18 ${x + 10},30" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<svg width="36" height="36" viewBox="0 0 36 36"><g${flip}>${sharp ? one(7) + one(17) : one(12)}</g></svg>`;
}
const PHONE = '<svg width="64" height="64" viewBox="0 0 64 64"><rect x="20" y="6" width="24" height="52" rx="4" fill="none" stroke="#bff6ff" stroke-width="3"/><line x1="28" y1="51" x2="36" y2="51" stroke="#bff6ff" stroke-width="3" stroke-linecap="round"/></svg>';

const ICONS = {
  triangle: '<svg width="34" height="30" viewBox="0 0 34 30"><polygon points="17,2 32,28 2,28" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
  square: '<svg width="30" height="30" viewBox="0 0 30 30"><rect x="3" y="3" width="24" height="24" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
  hexagon: '<svg width="32" height="30" viewBox="0 0 32 30"><polygon points="9,2 23,2 30,15 23,28 9,28 2,15" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
};

export function createHud(ctx, { palettes, onPick, onRetry, onMenu, onHover, onTurn, onPause, onResume, onToggleTouch }) {
  const style = document.createElement("style");
  style.textContent = CSS;
  ctx.ui.appendChild(style);
  const root = document.createElement("div");
  root.className = "nz";
  ctx.ui.appendChild(root);

  const menu = document.createElement("div");
  menu.innerHTML = `<div class="title">NEON&nbsp;SNAKE</div><div class="sub">CHOOSE YOUR GRID</div>
   <div class="hint menuhint">PRESS 1 · 2 · 3 OR CLICK A GRID — OTHER PLAYERS' MAPS GLOW BELOW</div>
   <div class="rothint">↻ ROTATE FOR THE BEST EXPERIENCE</div>`;
  root.appendChild(menu);
  const buttons = {};
  ["triangle", "square", "hexagon"].forEach((mode, i) => {
    const b = document.createElement("div");
    b.className = "btn";
    b.style.setProperty("--c", palettes[mode].grid);
    const dirs = mode === "square" ? "4 DIRECTIONS" : "6 DIRECTIONS";
    b.innerHTML = `<div style="display:flex;align-items:center;gap:12px;justify-content:center">${ICONS[mode]}<span>${i + 1} ${mode.toUpperCase()}</span></div><small>${mode === "square" ? "CLASSIC · " : ""}${dirs}</small>`;
    b.addEventListener("click", () => onPick(mode));
    b.addEventListener("mouseenter", () => onHover(mode));
    menu.appendChild(b);
    buttons[mode] = b;
  });
  // Desktop only: lets mouse users try the touch layout.
  const touchBtn = document.createElement("div");
  touchBtn.className = "btn tbtn";
  touchBtn.addEventListener("click", onToggleTouch);
  menu.appendChild(touchBtn);

  const play = document.createElement("div");
  play.innerHTML = `<div class="hud"><span class="mode"></span><b class="score">0</b><span class="len"></span></div>
   <div class="hudr"><div class="best"></div><div class="online"></div></div><div class="hint ctl"></div>`;
  root.appendChild(play);

  // Touch steering: left edge turns left, right edge turns right, the
  // (invisible) center pauses. Hexagon splits each edge into 60° / 120°.
  const touch = document.createElement("div");
  touch.className = "touch";
  play.appendChild(touch);
  let touchMode = null;
  function buildTouch(mode) {
    touchMode = mode;
    touch.innerHTML = "";
    for (const side of ["l", "r"]) {
      const zone = document.createElement("div");
      zone.className = "tz " + side;
      const sign = side === "l" ? 1 : -1;
      const parts = mode === "hexagon"
        ? [{ dir: 1, top: 0, h: 50 }, { dir: 2, top: 50, h: 50 }]
        : [{ dir: 1, top: 0, h: 100 }];
      parts.forEach((p, i) => {
        const b = document.createElement("div");
        b.className = "tb" + (parts.length > 1 && i === 0 ? " split" : "");
        b.style.top = p.top + "%";
        b.style.height = p.h + "%";
        b.innerHTML = chevron(sign, p.dir === 2);
        b.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          b.classList.remove("hit");
          void b.offsetWidth;
          b.classList.add("hit");
          setTimeout(() => b.classList.remove("hit"), 90);
          onTurn(sign * p.dir);
        });
        zone.appendChild(b);
      });
      touch.appendChild(zone);
    }
    const center = document.createElement("div");
    center.className = "tz c";
    // `click` (not pointerdown) so the same tap can't also land on the pause panel.
    center.addEventListener("click", onPause);
    touch.appendChild(center);
  }
  for (const ev of ["contextmenu", "dblclick"]) touch.addEventListener(ev, (e) => e.preventDefault());

  const over = document.createElement("div");
  over.className = "over";
  over.innerHTML = `<h1>DEREZZED</h1><p class="final"></p><div class="row"></div>`;
  const retry = document.createElement("div");
  retry.className = "btn"; retry.innerHTML = "RETRY<small>SPACE</small>";
  retry.addEventListener("click", onRetry);
  const back = document.createElement("div");
  back.className = "btn"; back.innerHTML = "MENU<small>ESC</small>";
  back.addEventListener("click", onMenu);
  over.querySelector(".row").append(retry, back);
  play.appendChild(over);

  const pause = document.createElement("div");
  pause.className = "over pause";
  pause.innerHTML = `<h1>PAUSED</h1><p>&nbsp;</p><div class="row"></div>`;
  const resume = document.createElement("div");
  resume.className = "btn"; resume.innerHTML = "RESUME<small>SPACE</small>";
  resume.addEventListener("click", onResume);
  const back2 = document.createElement("div");
  back2.className = "btn"; back2.innerHTML = "MENU<small>ESC</small>";
  back2.addEventListener("click", onMenu);
  pause.querySelector(".row").append(resume, back2);
  play.appendChild(pause);

  const rot = document.createElement("div");
  rot.className = "rot";
  rot.innerHTML = `${PHONE}<div>ROTATE YOUR DEVICE</div><div style="font-size:11px;opacity:.7">TOUCH CONTROLS NEED LANDSCAPE</div>`;
  root.appendChild(rot);

  const $ = (sel) => play.querySelector(sel);

  const toastEl = document.createElement("div");
  toastEl.className = "toast";
  root.appendChild(toastEl);
  const glowHint = document.createElement("div");
  glowHint.className = "glowhint";
  glowHint.textContent = "[ ] GLOW · M MUSIC";
  root.appendChild(glowHint);
  let toastTimer = null;

  let curState = "menu", curMode = null;
  const tc = { enabled: false, device: false, landscape: true };

  function refresh() {
    const state = curState, mode = curMode;
    const needRotate = tc.device && !tc.landscape;
    root.classList.toggle("tdev", tc.device);
    menu.style.display = state === "menu" ? "" : "none";
    play.style.display = state === "menu" ? "none" : "";
    over.style.display = state === "over" ? "flex" : "none";
    pause.style.display = state === "pause" ? "flex" : "none";
    rot.style.display = needRotate && (state === "play" || state === "pause") ? "flex" : "none";
    menu.querySelector(".rothint").style.display = needRotate ? "" : "none";
    menu.querySelector(".menuhint").textContent = tc.device
      ? "TAP A GRID TO PLAY"
      : "PRESS 1 · 2 · 3 OR CLICK A GRID — OTHER PLAYERS' MAPS GLOW BELOW";
    glowHint.style.display = tc.device ? "none" : "";
    touchBtn.style.display = tc.device ? "none" : "";
    touchBtn.classList.toggle("on", tc.enabled);
    touchBtn.textContent = "TOUCH CONTROLS: " + (tc.enabled ? "ON" : "OFF");
    const showTouch = tc.enabled && state === "play" && !needRotate;
    touch.style.display = showTouch ? "" : "none";
    if (mode && touchMode !== mode) buildTouch(mode);
    if (mode) {
      const c = palettes[mode].grid;
      play.style.setProperty("--c", c);
      for (const b of [retry, back, resume, back2]) b.style.setProperty("--c", c);
      $(".mode").textContent = mode.toUpperCase() + " GRID";
      $(".ctl").textContent = tc.enabled
        ? (mode === "hexagon" ? "TAP SIDES TO TURN · TOP 60° · BOTTOM 120° · TAP CENTER TO PAUSE" : "TAP SIDES TO TURN · TAP CENTER TO PAUSE")
        : mode === "square"
        ? "ARROWS / WASD TO STEER · ESC MENU"
        : mode === "hexagon"
        ? "← → OR A D TURN 60° · Z C SHARP TURN 120° · ESC MENU"
        : "← → OR A D TO TURN 60° · ESC MENU";
    }
  }

  return {
    buttons,
    toast(text) {
      toastEl.textContent = text;
      toastEl.style.opacity = "1";
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toastEl.style.opacity = "0"; }, 900);
    },
    show(state, mode) {
      curState = state;
      if (mode) curMode = mode;
      refresh();
    },
    setTouch(opts) {
      Object.assign(tc, opts);
      refresh();
    },
    // Highlights the menu button of the hovered board preview (or none).
    highlight(mode) {
      for (const m in buttons) buttons[m].classList.toggle("hl", m === mode);
    },
    placeButton(mode, x, y) {
      buttons[mode].style.left = x + "px";
      buttons[mode].style.top = y + "px";
    },
    setScore(score, len, best, online) {
      $(".score").textContent = score;
      $(".len").textContent = "LENGTH " + len;
      $(".best").textContent = "BEST " + best;
      $(".online").textContent = online > 0 ? online + " OTHER PLAYER" + (online > 1 ? "S" : "") + " ONLINE" : "SOLO · AI MAPS BELOW";
    },
    setFinal(score, best) {
      over.querySelector(".final").textContent = `SCORE ${score}  ·  BEST ${best}`;
    },
  };
}
