/**
 * `ctx.net`: multiplayer for game code. With `MULTIPLAYER_ENABLED` it is
 * carried over a Liveblocks room (presence for each player's shared state,
 * broadcast events for messages); otherwise it is a single-player stub with
 * the same API.
 */
import {
  LIVEBLOCKS_PUBLIC_KEY,
  LIVEBLOCKS_ROOM_ID,
  MULTIPLAYER_ENABLED,
} from "../config.js";

/** Largest JSON payload one `setState` or `send` may carry, in characters. */
export const MAX_NET_PAYLOAD_CHARS = 16_000;
/** Shortest gap between forwarded `setState` calls (20 Hz). */
export const NET_STATE_INTERVAL_MS = 50;
/** How long to wait for the room before playing offline. */
const CONNECT_TIMEOUT_MS = 5_000;
const CODE_GAME_EVENT_TYPE = "codeGame";
const PLAYER_STORAGE_KEY = "neonSnakePlayer";
const PLAYER_COLORS = ["#22f3ff", "#ff8a1f", "#ff3df0", "#8dff3a", "#ffe94d", "#ff2bd6", "#4d7cff"];

/** Copies a value through JSON so only plain data is shared. */
function toJson(value, what) {
  let text;
  try {
    text = JSON.stringify(value);
  } catch (error) {
    throw new Error(
      `${what} must be JSON data: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (text === undefined) return null;
  if (text.length > MAX_NET_PAYLOAD_CHARS) {
    throw new Error(
      `${what} is ${text.length} characters of JSON; the limit is ${MAX_NET_PAYLOAD_CHARS}. Send less data, or send it less often.`
    );
  }
  return JSON.parse(text);
}

function fitsPayload(value) {
  try {
    return JSON.stringify(value).length <= MAX_NET_PAYLOAD_CHARS;
  } catch {
    return false;
  }
}

/** Lowest connection id among the players: the same answer on every client. */
function electHost(selfId, otherIds) {
  let host = selfId;
  for (const id of otherIds) if (id < host) host = id;
  return host;
}

/** This browser's name and colour, kept across visits. */
function localPlayer() {
  try {
    const saved = JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY));
    if (typeof saved?.name === "string" && typeof saved?.color === "string") {
      return saved;
    }
  } catch {
    // A corrupt entry is replaced below.
  }
  const player = {
    userId: crypto.randomUUID(),
    name: "Player " + Math.floor(1000 + Math.random() * 9000),
    color: PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)],
  };
  localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(player));
  return player;
}

/**
 * Multiplayer for game code. Players are the open tabs in the room running
 * the game; the host is the one with the lowest id.
 */
export class GameNet {
  others = new Map();
  ownState = null;
  listeners = {
    join: new Set(),
    leave: new Set(),
    state: new Set(),
    message: new Set(),
    host: new Set(),
  };
  pendingState = undefined;
  stateTimer = null;
  lastStateSentAt = 0;
  stats = { setStateCalls: 0, sends: 0, received: 0 };

  /**
   * @param snapshot `{ online, self, others: [{ player, state }], hostId }`
   * @param post carries `{ kind: "setState", state }` and
   *   `{ kind: "send", topic, data, to }` to the other players
   */
  constructor(snapshot, post, reportError = console.error) {
    this.online = snapshot.online;
    this.me = snapshot.self;
    this.hostIdValue = snapshot.hostId;
    this.post = post;
    this.reportError = reportError;
    for (const entry of snapshot.others) this.others.set(entry.player.id, entry);
  }

  get hostId() {
    return this.hostIdValue;
  }

  get isHost() {
    return this.hostIdValue === this.me.id;
  }

  /** Everyone in the game, this player first. */
  players() {
    return [this.me, ...[...this.others.values()].map((entry) => entry.player)];
  }

  player(id) {
    if (id === this.me.id) return this.me;
    return this.others.get(id)?.player ?? null;
  }

  /** The latest state a player shared with `setState`, or null. */
  getState(id) {
    if (id === this.me.id) return this.ownState;
    return this.others.get(id)?.state ?? null;
  }

  /**
   * Shares this player's state (position, score, …) with everyone. Calls are
   * coalesced to 20 per second; the latest value always wins.
   */
  setState(state) {
    this.stats.setStateCalls += 1;
    this.ownState = toJson(state, "net.setState(state)");
    if (!this.online) return;
    this.pendingState = this.ownState;
    if (this.stateTimer !== null) return;
    const wait = Math.max(0, this.lastStateSentAt + NET_STATE_INTERVAL_MS - performance.now());
    this.stateTimer = setTimeout(() => {
      this.stateTimer = null;
      if (this.pendingState === undefined) return;
      this.lastStateSentAt = performance.now();
      this.post({ kind: "setState", state: this.pendingState });
      this.pendingState = undefined;
    }, wait);
  }

  /**
   * Sends a message to everyone else, or to one player with `{ to: id }`.
   * The sender does not receive its own messages.
   */
  send(topic, data = null, options = {}) {
    this.stats.sends += 1;
    if (typeof topic !== "string" || topic.length === 0) {
      throw new Error("net.send(topic, data) needs a non-empty topic string.");
    }
    const payload = toJson(data, `net.send("${topic}", data)`);
    if (!this.online) return;
    this.post({ kind: "send", topic, data: payload, to: options.to ?? null });
  }

  /** Subscribes to a multiplayer event; returns a function that unsubscribes. */
  on(name, listener) {
    const listeners = this.listeners[name];
    if (listeners === undefined) throw new Error(`net.on: unknown event "${name}".`);
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  notify(name, call) {
    for (const listener of this.listeners[name]) {
      try {
        call(listener);
      } catch (error) {
        this.reportError(error);
      }
    }
  }

  /** Applies one event from the transport. */
  receive(event) {
    switch (event.kind) {
      case "join":
        this.others.set(event.player.id, { player: event.player, state: event.state });
        this.notify("join", (listener) => listener(event.player));
        return;
      case "leave": {
        const entry = this.others.get(event.id);
        if (entry === undefined) return;
        this.others.delete(event.id);
        this.notify("leave", (listener) => listener(entry.player));
        return;
      }
      case "state": {
        const entry = this.others.get(event.id);
        if (entry === undefined) return;
        entry.state = event.state;
        this.notify("state", (listener) => listener(entry.player, event.state));
        return;
      }
      case "message": {
        const from = this.others.get(event.from)?.player;
        if (from === undefined) return;
        this.stats.received += 1;
        this.notify("message", (listener) => listener(event.topic, event.data, from));
        return;
      }
      case "host":
        if (event.hostId === this.hostIdValue) return;
        this.hostIdValue = event.hostId;
        this.notify("host", (listener) => listener(event.hostId, this.isHost));
        return;
    }
  }

  dispose() {
    if (this.stateTimer !== null) clearTimeout(this.stateTimer);
    for (const listeners of Object.values(this.listeners)) listeners.clear();
  }
}

/** Presence from another client, checked before it reaches game code. */
function readPresence(value) {
  if (typeof value !== "object" || value === null) return null;
  const { userId, name, color, state } = value;
  if (typeof userId !== "string" || userId.length > 128) return null;
  if (typeof name !== "string" || name.length > 64) return null;
  if (typeof color !== "string" || color.length > 16) return null;
  if (state !== null && !fitsPayload(state)) return null;
  return { userId, name, color, state: state ?? null };
}

/** A broadcast event from another client, checked the same way. */
function readRoomEvent(value) {
  if (typeof value !== "object" || value === null) return null;
  if (value.type !== CODE_GAME_EVENT_TYPE) return null;
  if (typeof value.topic !== "string" || value.topic.length < 1 || value.topic.length > 64) return null;
  if (value.to !== null && !Number.isInteger(value.to)) return null;
  if (!fitsPayload(value.data ?? null)) return null;
  return { topic: value.topic, data: value.data ?? null, to: value.to };
}

/**
 * Carries `ctx.net` over a Liveblocks room: a player's `codeGame` presence
 * names them and holds the state their game shares; `send` is a broadcast
 * event that everyone but the addressee drops.
 */
class LiveblocksSession {
  others = new Map();
  unsubscribers = [];
  sink = null;

  constructor(room, leaveRoom, self) {
    this.room = room;
    this.leaveRoom = leaveRoom;
    this.self = self;
    this.hostId = self.id;
    this.readOthers();
    this.unsubscribers.push(
      room.subscribe("others", () => this.readOthers()),
      room.subscribe("event", ({ event, connectionId }) => this.receiveEvent(event, connectionId))
    );
  }

  snapshot() {
    return { online: true, self: this.self, others: [...this.others.values()], hostId: this.hostId };
  }

  presence(state) {
    return {
      codeGame: { userId: this.self.userId, name: this.self.name, color: this.self.color, state },
    };
  }

  handle(event) {
    switch (event.kind) {
      case "setState":
        if (fitsPayload(event.state)) this.room.updatePresence(this.presence(event.state));
        return;
      case "send":
        if (!fitsPayload(event.data)) return;
        this.room.broadcastEvent({
          type: CODE_GAME_EVENT_TYPE,
          topic: event.topic,
          data: event.data,
          to: event.to,
        });
        return;
    }
  }

  readOthers() {
    const next = new Map();
    for (const other of this.room.getOthers()) {
      const presence = readPresence(other.presence?.codeGame);
      if (presence === null) continue;
      next.set(other.connectionId, {
        player: {
          id: other.connectionId,
          userId: presence.userId,
          name: presence.name,
          color: presence.color,
          avatarUrl: null,
        },
        state: presence.state,
      });
    }
    const previous = this.others;
    this.others = next;
    const hostId = electHost(this.self.id, next.keys());
    const hostChanged = hostId !== this.hostId;
    this.hostId = hostId;
    if (this.sink === null) return;
    for (const [id, entry] of next) {
      const before = previous.get(id);
      if (before === undefined) {
        this.sink({ kind: "join", player: entry.player, state: entry.state });
      } else if (JSON.stringify(before.state) !== JSON.stringify(entry.state)) {
        this.sink({ kind: "state", id, state: entry.state });
      }
    }
    for (const id of previous.keys()) {
      if (!next.has(id)) this.sink({ kind: "leave", id });
    }
    if (hostChanged) this.sink({ kind: "host", hostId });
  }

  receiveEvent(event, connectionId) {
    const parsed = readRoomEvent(event);
    if (parsed === null) return;
    if (parsed.to !== null && parsed.to !== this.self.id) return;
    if (!this.others.has(connectionId)) return;
    this.sink?.({ kind: "message", from: connectionId, topic: parsed.topic, data: parsed.data });
  }

  leave() {
    for (const unsubscribe of this.unsubscribers.splice(0)) unsubscribe();
    this.sink = null;
    this.leaveRoom();
  }
}

/** Resolves with the room's own connection id once connected, or null on timeout. */
function waitForSelf(room) {
  return new Promise((resolve) => {
    const self = room.getSelf();
    if (self !== null) {
      resolve(self.connectionId);
      return;
    }
    const timer = setTimeout(() => {
      unsubscribe();
      resolve(null);
    }, CONNECT_TIMEOUT_MS);
    const unsubscribe = room.subscribe("status", (status) => {
      const current = room.getSelf();
      if (status !== "connected" || current === null) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(current.connectionId);
    });
  });
}

function offlineNet(player, reportError) {
  const self = { id: 0, avatarUrl: null, ...player };
  return {
    net: new GameNet({ online: false, self, others: [], hostId: self.id }, () => undefined, reportError),
    leave: () => undefined,
  };
}

async function connectLiveblocks(player, reportError) {
  // The vendored Liveblocks build reads `process.env.NODE_ENV` as it loads.
  globalThis.process ??= { env: { NODE_ENV: "production" } };
  const { createClient } = await import("@liveblocks/client");
  const client = createClient({ publicApiKey: LIVEBLOCKS_PUBLIC_KEY });
  const { room, leave } = client.enterRoom(LIVEBLOCKS_ROOM_ID, {
    initialPresence: { codeGame: { ...player, state: null } },
  });
  const selfId = await waitForSelf(room);
  if (selfId === null) {
    console.warn("Liveblocks did not connect; playing offline.");
    leave();
    return offlineNet(player, reportError);
  }
  const session = new LiveblocksSession(room, leave, { id: selfId, avatarUrl: null, ...player });
  const net = new GameNet(session.snapshot(), (event) => session.handle(event), reportError);
  session.sink = (event) => net.receive(event);
  return { net, leave: () => session.leave() };
}

/** `{ net, leave }`: online over Liveblocks when enabled and configured, else offline. */
export async function createNet(reportError) {
  const player = localPlayer();
  if (!MULTIPLAYER_ENABLED || LIVEBLOCKS_PUBLIC_KEY === "") {
    return offlineNet(player, reportError);
  }
  try {
    return await connectLiveblocks(player, reportError);
  } catch (error) {
    console.warn("Multiplayer failed to start; playing offline.", error);
    return offlineNet(player, reportError);
  }
}
