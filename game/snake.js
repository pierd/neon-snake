// Snake rules, independent of board shape. Also drives the AI demo snakes.
import { nextCell, normAngle, angDiff } from "./boards.js";

export class SnakeGame {
  constructor(board, rand = Math.random) {
    this.board = board;
    this.rand = rand;
    this.best = 0;
    this.reset();
  }

  reset() {
    const b = this.board;
    this.heading = 0;
    this.queue = [];
    const body = [b.center];
    let cur = b.center;
    for (let i = 0; i < 3; i++) {
      const n = nextCell(b, cur, this.heading + Math.PI);
      if (n < 0) break;
      body.push(n);
      cur = n;
    }
    this.snake = body;
    this.grow = 0;
    this.alive = true;
    this.score = 0;
    this.eaten = 0;
    this.placeFood();
  }

  placeFood() {
    const occ = new Set(this.snake);
    const free = [];
    for (const c of this.board.cells) if (!occ.has(c.id)) free.push(c.id);
    this.food = free.length ? free[Math.floor(this.rand() * free.length)] : -1;
  }

  plannedHeading() {
    return this.queue.length ? this.queue[this.queue.length - 1] : this.heading;
  }

  // dir: +1 turns left (counter-clockwise), -1 turns right.
  turn(dir) {
    if (this.queue.length >= 3) return false;
    this.queue.push(normAngle(this.plannedHeading() + dir * this.board.headingStep));
    return true;
  }

  // Absolute heading (square mode arrows); ignores reversing and repeats.
  steer(angle) {
    const base = this.plannedHeading();
    const d = angDiff(angle, base);
    if (d < 0.01 || d > Math.PI - 0.01 || this.queue.length >= 3) return false;
    this.queue.push(normAngle(angle));
    return true;
  }

  blocked(cell) {
    if (cell < 0) return true;
    const i = this.snake.indexOf(cell);
    if (i < 0) return false;
    // Moving into the tail is fine when it moves away this tick.
    return !(i === this.snake.length - 1 && this.grow === 0 && cell !== this.food);
  }

  tick() {
    if (!this.alive) return null;
    if (this.queue.length) this.heading = this.queue.shift();
    const next = nextCell(this.board, this.snake[0], this.heading);
    if (this.blocked(next)) {
      this.alive = false;
      this.best = Math.max(this.best, this.score);
      return next < 0 ? "wall" : "self";
    }
    const eat = next === this.food;
    this.snake.unshift(next);
    if (this.grow > 0) this.grow--;
    else if (!eat) this.snake.pop();
    if (eat) {
      this.eaten++;
      this.score += 10;
      this.grow += 1;
      this.placeFood();
      return "eat";
    }
    return "move";
  }

  // Free cells reachable from `start`, capped, assuming the body stays put.
  space(start, cap) {
    const occ = new Set(this.snake);
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length && seen.size < cap) {
      const c = stack.pop();
      for (const e of this.board.cells[c].edges)
        if (e.neighbor >= 0 && !occ.has(e.neighbor) && !seen.has(e.neighbor)) {
          seen.add(e.neighbor);
          stack.push(e.neighbor);
        }
    }
    return seen.size;
  }

  // Simple greedy AI: head toward the food, avoid traps, wander a little.
  think() {
    const step = this.board.headingStep;
    const f = this.board.cells[this.food];
    const need = Math.min(this.snake.length + 4, 60);
    let best = null, bestScore = -Infinity;
    // Hexagon also allows sharp 120° turns, like the player's Z/C keys.
    const dirs = this.board.mode === "hexagon" ? [0, 1, -1, 2, -2] : [0, 1, -1];
    for (const d of dirs) {
      const h = normAngle(this.heading + d * step);
      const n = nextCell(this.board, this.snake[0], h);
      if (this.blocked(n)) continue;
      const c = this.board.cells[n];
      let s = f ? -Math.hypot(c.cx - f.cx, c.cy - f.cy) : 0;
      if (this.space(n, need) < need) s -= 1000;
      s += this.rand() * 0.8 + (d === 0 ? 0.3 : 0);
      if (s > bestScore) { bestScore = s; best = h; }
    }
    this.queue = best === null ? [] : [best];
  }
}
