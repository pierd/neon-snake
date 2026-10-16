/** Key and pointer state, sampled by game code from `update`. */
export class GameInput {
  down = new Set();
  pressed = new Set();
  released = new Set();
  /** Pointer position in normalized device coordinates (-1..1, y up). */
  pointer = {
    x: 0,
    y: 0,
    /** Movement since the last frame, in pixels (works under pointer lock). */
    dx: 0,
    dy: 0,
    buttons: 0,
    locked: false,
  };

  constructor(canvas) {
    this.canvas = canvas;
    window.addEventListener("keydown", (event) => {
      if (event.repeat) return;
      this.down.add(event.code);
      this.pressed.add(event.code);
    });
    window.addEventListener("keyup", (event) => {
      this.down.delete(event.code);
      this.released.add(event.code);
    });
    window.addEventListener("blur", () => this.down.clear());
    window.addEventListener("pointermove", (event) => {
      const rect = canvas.getBoundingClientRect();
      this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      this.pointer.dx += event.movementX;
      this.pointer.dy += event.movementY;
    });
    window.addEventListener("pointerdown", (event) => {
      this.pointer.buttons = event.buttons;
    });
    window.addEventListener("pointerup", (event) => {
      this.pointer.buttons = event.buttons;
    });
    document.addEventListener("pointerlockchange", () => {
      this.pointer.locked = document.pointerLockElement === canvas;
    });
  }

  /** True while the key (a `KeyboardEvent.code`, like "KeyW") is held. */
  isDown(code) {
    return this.down.has(code);
  }

  /** True on the first frame the key is down. */
  wasPressed(code) {
    return this.pressed.has(code);
  }

  /** True on the frame the key is let go. */
  wasReleased(code) {
    return this.released.has(code);
  }

  /** -1, 0, or 1 from a pair of keys, like axis("KeyA", "KeyD"). */
  axis(negative, positive) {
    return (this.isDown(positive) ? 1 : 0) - (this.isDown(negative) ? 1 : 0);
  }

  /** Locks the pointer to the canvas; call from a click handler. */
  lockPointer() {
    void this.canvas.requestPointerLock();
  }

  /** Clears per-frame state; the runtime calls it after each `update`. */
  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.pointer.dx = 0;
    this.pointer.dy = 0;
  }
}
