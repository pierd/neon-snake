// HTML overlay: title menu with the three modes, in-game HUD, game-over panel.
const CSS = `
.nz{position:absolute;inset:0;font-family:"Courier New",ui-monospace,monospace;color:#bff6ff;user-select:none}
.nz .title{position:absolute;top:7%;width:100%;text-align:center;font-size:clamp(34px,6vw,76px);font-weight:900;letter-spacing:.35em;
 color:#e8fdff;text-shadow:0 0 8px #00e5ff,0 0 24px #00e5ff,0 0 60px #0088ff}
.nz .sub{position:absolute;top:calc(7% + clamp(46px,8vw,96px));width:100%;text-align:center;letter-spacing:.5em;font-size:13px;color:#7fdcff;opacity:.85}
.nz .btn{position:absolute;transform:translate(-50%,0);pointer-events:auto;cursor:pointer;background:rgba(0,10,20,.65);
 border:2px solid var(--c);color:var(--c);padding:10px 26px;font:900 18px "Courier New",monospace;letter-spacing:.3em;
 box-shadow:0 0 12px var(--c),inset 0 0 12px var(--c);text-shadow:0 0 8px var(--c);transition:transform .12s,background .12s}
.nz .btn:hover{background:var(--c);color:#02060c;transform:translate(-50%,0) scale(1.08)}
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
`;

const ICONS = {
  triangle: '<svg width="34" height="30" viewBox="0 0 34 30"><polygon points="17,2 32,28 2,28" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
  square: '<svg width="30" height="30" viewBox="0 0 30 30"><rect x="3" y="3" width="24" height="24" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
  hexagon: '<svg width="32" height="30" viewBox="0 0 32 30"><polygon points="9,2 23,2 30,15 23,28 9,28 2,15" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
};

export function createHud(ctx, { palettes, onPick, onRetry, onMenu, onHover }) {
  const style = document.createElement("style");
  style.textContent = CSS;
  ctx.ui.appendChild(style);
  const root = document.createElement("div");
  root.className = "nz";
  ctx.ui.appendChild(root);

  const menu = document.createElement("div");
  menu.innerHTML = `<div class="title">NEON&nbsp;SNAKE</div><div class="sub">CHOOSE YOUR GRID</div>
   <div class="hint">PRESS 1 · 2 · 3 OR CLICK A GRID — OTHER PLAYERS' MAPS GLOW BELOW</div>`;
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

  const play = document.createElement("div");
  play.innerHTML = `<div class="hud"><span class="mode"></span><b class="score">0</b><span class="len"></span></div>
   <div class="hudr"><div class="best"></div><div class="online"></div></div><div class="hint ctl"></div>`;
  root.appendChild(play);

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

  const $ = (sel) => play.querySelector(sel);

  const toastEl = document.createElement("div");
  toastEl.className = "toast";
  root.appendChild(toastEl);
  const glowHint = document.createElement("div");
  glowHint.className = "glowhint";
  glowHint.textContent = "[ ] GLOW · M MUSIC";
  root.appendChild(glowHint);
  let toastTimer = null;

  return {
    buttons,
    toast(text) {
      toastEl.textContent = text;
      toastEl.style.opacity = "1";
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toastEl.style.opacity = "0"; }, 900);
    },
    show(state, mode) {
      menu.style.display = state === "menu" ? "" : "none";
      play.style.display = state === "menu" ? "none" : "";
      over.style.display = state === "over" ? "flex" : "none";
      if (mode) {
        const c = palettes[mode].grid;
        play.style.setProperty("--c", c);
        retry.style.setProperty("--c", c);
        back.style.setProperty("--c", c);
        $(".mode").textContent = mode.toUpperCase() + " GRID";
        $(".ctl").textContent = mode === "square"
          ? "ARROWS / WASD TO STEER · ESC MENU"
          : mode === "hexagon"
          ? "← → OR A D TURN 60° · Z C SHARP TURN 120° · ESC MENU"
          : "← → OR A D TO TURN 60° · ESC MENU";
      }
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
